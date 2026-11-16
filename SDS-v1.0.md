# F1 空气动力学 3D 交互展示 — SDS v1.0

> 单文件 HTML / Three.js / 零物理引擎。本文件是唯一实现准则，代码阶段任何偏离必须先反改本文件。

---

## 0. 边界与硬约束

| # | 约束 | 判定方式 |
|---|---|---|
| H1 | 交付物 `f1-aero.html` 单文件；JS 内联 `<script type="module">`，CSS 内联 `<style>`，无构建、无 npm | 目录里只有 1 个 html |
| H2 | 唯一外部依赖 `three@0.187.0`，经 importmap 锁 `unpkg.com/three@0.187.0/`（本次会话实测的 registry latest） | importmap 里带完整 patch 版本号 |
| H3 | 零物理引擎：无 cannon-es / rapier / ammo.js；气流是解析场 + 着色器 | 全局搜不到 `world.step` |
| H4 | 零每帧分配：rAF 内不出现 `new`，不 `.map()/.filter()` 造数组，不 `traverse` | 逐行 review `onFrame` |
| H5 | 零框架：无 React/Vue/dat.gui/tweakpane/TweenMax | 只有 three 一个 import |
| H6 | 基线 60fps@1920×1080；降级阶梯见 §5.7 | 帧时间 EMA |
| H7 | 数据诚实：所有下压力/CD/车速是**演示数据**，UI 常驻 `DEMO` 徽标，数值只出自 `DEMO` 常量表 | 全局搜魔数 |
| H8 | `file://` 直开时 `fetch(glb)` 被 CORS 拦，必须显式降级并提示「请用本地服务器」 | 见 §6 |

尺寸基准（演示值，对齐 2026 技术规则量级）：车长 5.63 m、车宽 1.90 m、轴距 3.40 m、最小离地 75 mm、整车 768 kg。

---

## 1. 核心状态机与数据字典

### 1.1 坐标系（写死，全项目不再讨论）

- 世界：`+Y` 上，**车头朝 `-Z`**，`车右 = +X`
  - 右手系验证：`f×u = (0,0,-1)×(0,1,0) = (1,0,0)` → 右 = +X。所有 L/R 判定依赖此约定。
- 单位：米。任何模型在进入业务逻辑前必须归一到该坐标系（§2.2）。
- 相机默认位 `HOME_CAM = (4.8, 2.1, -6.4)`，看向 `(0, 0.55, 0)`（车头右前 3/4）。

### 1.2 `appState` —— 唯一可变状态源

```js
const appState = {
  phase:   'BOOT',      // 'BOOT' | 'READY' | 'FAILED'
  view:    'EXTERIOR',  // 'EXTERIOR' | 'AIRFLOW'
  isolate: null,        // null | PartId
  drs:     false,       // boolean
  quality: 0,           // 0 | 1 | 2
  uiHidden:false,
  tween:   { cam: 0, drs: 0 },   // 归一化过渡进度，非时间
};
```

派生量**不存**，用函数算：`isIsolating(s) = s.isolate !== null`；`aeroActive(s) = s.view === 'AIRFLOW' && s.isolate === null`。

不变量（代码里 `assertInvariants()`，仅 `DEV` 下跑）：

| # | 不变量 |
|---|---|
| I1 | `view === 'AIRFLOW'` ⇒ `isolate === null`（进气流视图强制退出隔离） |
| I2 | `isolate !== null` ⇒ 该 `partRoot.visible === true` 且其余 partRoot 全 `false` |
| I3 | `phase !== 'READY'` ⇒ 所有指针事件直接丢弃，不进 raycast |
| I4 | `drs === true` ⇒ `tween.drs` 单调趋近 1，禁止跳变 |
| I5 | 同一时刻只有一次相机过渡在跑（token 机制，新过渡令旧 token 失效） |
| I6 | UI 只在状态变更时重建；每帧只允许写 FPS 与热点 `transform` |

### 1.3 事件与状态转移表

| 事件 | from | guard | to | 副作用（顺序即执行顺序） |
|---|---|---|---|---|
| `MODEL_OK` | BOOT | — | READY | 建件根、编译着色器、启动 rAF |
| `MODEL_FAIL` | BOOT | — | READY | 生成程序化降级车，`#ui-boot` 显示警告 |
| `CLICK_PART(id)` | READY | id 已注册 | 不变 | `isolate=id` → 隐藏其余 → 相机聚焦 → 填卡 |
| `CLICK_EMPTY` | READY | `isolate!==null` | 不变 | 等同 `EXIT_ISOLATE` |
| `EXIT_ISOLATE` / `ESC` | READY | `isolate!==null` | 不变 | 按 `prevVisible` 恢复 → 相机回 `HOME_CAM` → 清卡 |
| `SET_VIEW('AIRFLOW')` | READY | — | 不变 | 若在隔离则先 `EXIT_ISOLATE`；`uni.uAeroOn=1` |
| `SET_VIEW('EXTERIOR')` | READY | — | 不变 | `uni.uAeroOn=0`（粒子不渲染，省填充率） |
| `TOGGLE_DRS` | READY | — | 不变 | 翻转 `drs`，启动 `tween.drs` 阻尼 |
| `RESET_CAM` | READY | — | 不变 | 清隔离，相机回 `HOME_CAM` |
| `QUALITY_SET(q)` | READY | — | 不变 | 应用 dpr/粒子数/阴影/描边 |

### 1.4 唯一写入通道

```js
dispatch({ type, payload }) → guard() → 变更 appState → applyEffects(type)
```

- 事件处理器**只准**调 `dispatch`。禁止在 handler 里直接改 `scene` / DOM / 材质。
- `applyEffects` 是纯函数式的 switch，一个 type 一段，互不调用。
- 任何「读 appState → 写 DOM」都写在 `effects` 里，保证因果可追。

### 1.5 数据字典（防命名冲突）

**顶层标识符只有 4 个**（其余全部挂在它们下面，杜绝全局变量打架）：

| 名字 | 内容 |
|---|---|
| `APP` | `{ renderer, scene, camera, controls, clock, ... }` 渲染上下文 |
| `DOM` | `{ root, canvas, top, dock, card, boot, fps, ... }` 每个元素只查一次 |
| `S` | 预分配暂存池 `{ v1..v4, box1, sph1, m4, col1, ray, ndc, dir }`（H4 靠它落地） |
| `PARTS` | 只读注册表（冻结），见下 |

**部件注册表**（`Object.freeze`，id 用 UPPER_SNAKE，字符串值也是 id）：

| id | 中文 | 气动贡献 % | 质量 kg | 是否热点 |
|---|---|---|---|---|
| `FRONT_WING` | 前翼总成 | 24 | 12.0 | ✓ |
| `FRONT_WING_FLAP` | 前翼活动襟翼 | 6 | 1.2 | |
| `NOSE` | 鼻锥 | 5 | 4.5 | ✓ |
| `HALO` | 光环护架 | 2 | 7.0 | |
| `COCKPIT` | 座舱/单体壳 | 4 | 82.0 | |
| `AIRBOX` | 进气口/防滚架 | 3 | 6.5 | ✓ |
| `ENGINE_COVER` | 引擎盖 | 8 | 9.0 | ✓ |
| `SIDEPOD_L` / `SIDEPOD_R` | 侧箱 | 11 / 11 | 14.0 | ✓ |
| `FLOOR` | 底板 | 18 | 16.0 | ✓ |
| `DIFFUSER` | 扩散器 | 9 | 5.5 | ✓ |
| `REAR_WING_MAIN` | 尾翼主翼 | 15 | 6.0 | ✓ |
| `REAR_WING_FLAP` | 尾翼活动襟翼（DRS） | 5 | 1.4 | |
| `BEAM_WING` | 梁翼 | 4 | 2.0 | |
| `WHEEL_FL` `WHEEL_FR` `WHEEL_RL` `WHEEL_RR` | 车轮 | 3 | 9.5 | ✓ |
| `BRAKE_DUCT_L` `BRAKE_DUCT_R` | 刹车导风 | 2 | 1.5 | |
| `SUSPENSION` | 悬挂 | 3 | 22.0 | |
| `MIRROR_L` `MIRROR_R` | 后视镜 | 1 | 0.4 | |
| `MISC` | 未归类 | 0 | — | |

运行时 `parts: Map<PartId, PartRecord>`：

```ts
PartRecord = { id, root: Group, meshes: Mesh[], box: Box3,
               center: Vector3, radius: number, tri: number, prevVisible: boolean }
```

其他索引：

- `meshTag: WeakMap<Mesh, PartId>` —— 拾取后 O(1) 反查
- `pickables: Mesh[]` —— **扁平数组、一次构建**，`intersectObjects(pickables, false)`
- 命名规则：`g*`=Group、`m*`=Material、`geo*`=BufferGeometry、`u*`=Shader uniform、`T*`=Texture、`_v1`=临时值、DOM id 前缀 `ui-`、CSS class 前缀 `u-`。

---

## 2. 模型加载与解剖

### 2.1 加载链

```
GLTFLoader ← LoadingManager(onProgress→#ui-boot 进度条, onError→MODEL_FAIL)
Promise.race([loadAsync(url, 'glb'), timeout(12_000)])   // 硬超时防白屏
```

- 只在 glb 确为 Draco 压缩时才挂 `DRACOLoader`（decoder 走 CDN）；不启用 KTX2（少一个 wasm 依赖，H1）。
- 加载完成后 `root.updateMatrixWorld(true)` —— 后续 `Box3.setFromObject` 与 `attach` 都依赖它。

### 2.2 坐标系归一化（3 步，含防二次缩放）

1. **量**：`S.box1.setFromObject(gltf.scene)` 得 `size`。
2. **转**：取最长轴 → 旋到 Z。最长轴为 Y/X 时绕相应轴 ±90°。
   车头判定：在归一化前先跑一次关键词扫描，取 `front` 命中部件的 `box.center.z`；若为正（车头在 +Z），`rotateY(π)`。
3. **缩**：`s = 5.63 / size.z`；**若 `size.z ∈ [4.5, 6.5]` 视为已归一化，跳过缩放**（防 A 模型已按米建模被二次放大）。
4. **落地**：平移使 `box.min.y = 0.02`。

归一化参数写入 `APP.modelXform` 并 `console.info`，出问题第一件事看这里。

### 2.3 部件根重建（隔离性能的关键）

隔离必须 O(#parts)，不是 O(#meshes)。所以**不改原始层级，另建一层部件骨架**：

```
traverse(gltf.scene):
  if (!o.isMesh) continue                    // 跳过 Points/Line/Sprite
  id = classify(o)                            // §2.4
  meshTag.set(o, id)

for each id in parts:
  g = new Group(); g.name = 'part:' + id; gCar.add(g)
  for m of meshesOf(id): g.attach(m)          // attach 保世界变换；add 会丢
```

- `attach` 之前必须 `updateMatrixWorld(true)`；本管线不支持骨骼动画（静态展示模型），若检测到 `SkinnedMesh` 走 `MISC` 并 warn。
- 之后所有可见性/描边/bbox 只操作 `root`，单件隔离就 20 行。

### 2.4 模糊匹配（单遍、确定性、可解释）

**干草堆**（一次拼好，只匹配一次）：

```
hay = normalize([mesh.name, p1.name, p2.name, p3.name, material.name].join(' '))
```

`normalize` 精确规则：小写 → 去前缀 `[SM]_` / `polySurface` / `Object_` / `node_` / `Mesh_` / `Geo_` → 去后缀 `.001`/`.002`（Blender 重名）→ 非字母数字折叠为单空格 → 压缩连续空格。

**有序规则表**（数组下标即优先级，`first match wins`，命中即停）。顺序有因果关系，不得重排：

| 序 | 正则 | 归类 |
|---|---|---|
| 1 | `(drs|active).*(flap|wing)|rear.*flap` | `REAR_WING_FLAP` ← 必须先于 5 |
| 2 | `beam.*wing|rear.*beam` | `BEAM_WING` |
| 3 | `front.*(flap|winglet)` | `FRONT_WING_FLAP` |
| 4 | `brake.*(duct|cool)` | `BRAKE_DUCT_*` ← 必须先于 7 |
| 5 | `rear.*(wing|aerofoil)` | `REAR_WING_MAIN` |
| 6 | `front.*wing` | `FRONT_WING` |
| 7 | `diffuser|rear.*floor|rake` | `DIFFUSER` |
| 8 | `floor|plank|underbody` | `FLOOR` |
| 9 | `side ?pod|bargeboard` | `SIDEPOD_*` |
| 10 | `halo` | `HALO` |
| 11 | `airbox|roll ?hoop|snorkel` | `AIRBOX` |
| 12 | `engine.*cover|bodywork|cowl|shark` | `ENGINE_COVER` |
| 13 | `cockpit|monocoque|chassis|tub` | `COCKPIT` |
| 14 | `mirror` | `MIRROR_*` |
| 15 | `tyre|tire|wheel|rim` | `WHEEL_*` |
| 16 | `suspension|wishbone|pushrod` | `SUSPENSION` |
| 17 | `nose|cone` | `NOSE` |
| 18 | `exhaust|antenna|t ?cam|wing ?mount` | `MISC` |

**L/R 与角位由几何决定，不由名字**（模型命名不可信）：

```
W = 1.90, L = 5.63
side  = x >  +0.10W ? 'R' : x < -0.10W ? 'L' : 'C'      // 注意：+X = 车右
axial = z <  -0.12L ? 'F' : z > +0.20L ? 'R' : 'M'      // 车头 -Z
```

- `WHEEL_*` 且 `side === 'C'` → 标 `UNRESOLVED`，`console.warn`，归 `MISC`，**不参与隔离**（不允许出现「两个轮子被当成一个件」）。
- 分类结果在 `DEV` 下 `console.table` 全量输出（名字 → 归类 → 置信度来源），这是唯一排障入口。

### 2.5 几何兜底（仅对未命中规则者）

按序尝试 5 条启发式，命中即停：

1. `|x| > 0.32W` 且 bbox 三边近似 1:1:0.55 → 车轮
2. 最薄边 < 0.08 m 且位于 `y > 0.35` 或 `y < 0.25` 的板状体 → 翼片
3. `z < -0.30L` 且最扁 → 前翼
4. `z > +0.32L` 且最扁 → 尾翼
5. 其余 → `MISC`

全部落 `MISC` 也不阻断任何功能（隔离单件仍可用）。

### 2.6 每件统计（一次性）

`tri` 求和、`box`（`makeEmpty()` + 逐 mesh `expandByObject`）、`center`、`radius`（`box.getBoundingSphere`）。写进 `PartRecord`，之后不再重算。

### 2.7 材质与光照

- **材质必须 clone**：glb 常多个 mesh 共享同一 material，直接改 `emissive` 会串色。加载后对每件 clone 一次（材质总数通常 < 20），原 `emissive` 存 `material.userData.origEmissive`。
- 环境光：无 HDRI 文件 → `RoomEnvironment` + `PMREMGenerator` 生成 `scene.environment`，`envMapIntensity ≈ 0.9`。
- 灯：1× `DirectionalLight(0xfff2e0, 2.2)` + `HemisphereLight(0x9fc4ff, 0x0a0f16, 0.55)`，无阴影相机手工调参外的花活。
- 阴影：仅 `tri < 50k` 的件 `castShadow`，`quality >= 1` 整体关闭。
- `frustumCulled` 保持 `true`。

### 2.8 程序化降级车（必须实现，不可省）

glb 缺失/超时/`file://` 时，用 12 个 `BoxGeometry`/`CylinderGeometry` 拼一台可辨识概念车（严格按 5.63 × 1.90 × 1.05 构图：前后翼各 2 片、4 轮圆柱、单体壳、侧箱、引擎盖、扩散器），**直接构造 `PartRecord`**，跳过 classify。目的：UI / 气流 / 隔离 / 相机全管线永远有数据可跑，验收第 2 条依赖它。

---

## 3. 交互热点与单件隔离

### 3.1 指针管线（不与 OrbitControls 抢事件）

- canvas 只监听 `pointerdown / pointermove / pointerup`（`passive: true`），**handler 里不做 raycast**，只填：

```js
ptr = { nx, ny, downX, downY, downT, moved, dirty }
```

- 真正的拾取在 rAF 里跑，且 `if (!ptr.dirty) return`（§5.1 第 3 步）。
- **click 判定**：`|nx-downX| + |ny-downY| < 6px` 且 `t - downT < 400ms`。否则视为旋转拖拽，丢弃。
- 命中过滤：`obj.visible && obj.parent.visible`（隔离时隐藏的正是 `partRoot`）。
- `raycaster.setFromCamera(S.ndc, cam)`；`intersectObjects(pickables, false)`。
- 结果经 `meshTag` 反查 `PartId`；先命中最近的那个 mesh 所属部件。
- hover 拾取额外节流：`ndc` 位移 < 0.002 且 `hoveredPartId` 未变 → 跳过。
- 触屏无 hover：`pointerType === 'touch'` 直接跳过 hover 分支。

### 3.2 隔离执行序列（顺序固定）

1. `prevVisible` 快照：把每个 `root.visible` 存进 `record.prevVisible`。
2. 隐藏：`for (p of parts) p.root.visible = (p.id === id)`。
3. 不动的：`gCar.visible` 保持 true；关掉 `grp.helpers`（网格/地面）。
4. 描边（仅 `quality === 0`）：单件加一层 `EdgesGeometry + LineSegments`（`LineBasicMaterial`，`depthTest` 开），退出即 dispose。
5. 相机过渡（§3.4）。
6. 填卡（§3.5）+ `document.body.classList.add('isolating')`。
7. **退出时按 `prevVisible` 逐一恢复**，禁止一把 `visible = true`（会点亮本应隐藏的杂物）。

### 3.3 悬停反馈

- 只在 `hoveredPartId` 变化时写材质：`emissive.setHex(0x0e2a1c)`，离开还原 `userData.origEmissive`。
- `canvas.style.cursor = hit ? 'pointer' : 'grab'`。
- 悬停不改变可见性、不移动相机（避免「抖一下就跳」。

### 3.4 相机聚焦（公式写死）

```js
v      = cam.position.clone().sub(controls.target).normalize()   // 保留用户当前视角
center = part.box.getCenter(S.v1)
r      = part.box.getBoundingSphere(S.sph).radius
dist   = clamp(r / Math.sin(fov * DEG2RAD * 0.5) * 1.18, 0.35, 9)
goal.pos  = center + v * dist
goal.look = center + (0, r * 0.15, 0)     // 略上抬，部件不贴画面上沿
```

- 阻尼必须帧率无关：`k = 1 - Math.exp(-λ*dt)`，λ_cam = 8，λ_look = 11。
- 终止：`posDistSq < 1e-6 && lookDistSq < 1e-6` → 吸附、`tween.cam = 0`、`controls.enabled = true`。
- 过渡期间 `controls.enabled = false`，且每帧 `controls.update()` 后强制写回 `controls.target`。
- **token 机制**：`APP.camToken++`，收敛回调里比对 token，不一致直接 return（防快速连点抽搐）。
- 退出隔离：`goal = HOME_CAM`，走同一条管线。
- 动态近平面：`near = clamp(dist * 0.02, 0.01, 0.5)`；**仅当变化 > 5% 才** `updateProjectionMatrix()`。

### 3.5 侧边信息卡（HTML 覆盖层）

```
#ui-card[data-part]
  ├ .card-kicker   DEMO / 部件编号
  ├ .card-zh       中文名        .card-en  英文名
  ├ .card-role     功能描述（≤120 字）
  ├ .card-meta     材料 / 质量 / 气动贡献
  └ .card-bar > i  气动贡献条形（CSS width %，transition 200ms）
```

- 数据源：`PARTS[id]` 静态字段 + `PartRecord.tri` / `radius` 实测量。
- `fillCard(id)` **只在 enter/exit 调用**，不每帧刷新。
- 进入用 `[data-open]` 类驱动 `transform: translateX(0)`，退出 `translateX(24px)+opacity:0`，180ms `cubic-bezier(.2,.8,.2,1)`。
- 无障碍：`role="complementary"` `aria-live="polite"`；`Esc` 与卡片返回按钮同效。

### 3.6 3D 锚定热点标签（独立层，默认开、Q2 关）

- 只给 `PARTS[id].hotspot === true` 的部件建标签，**总数 ≤ 6**，DOM 池复用。
- 每帧：`v.copy(center).project(cam)` → 屏幕坐标；条件 `v.z < 1`（在相机前方）。
- 遮挡：每标签**每 6 帧** 1 次 raycast（center → camera），命中且非自身 → `opacity: .15`。
- 抖动抑制：屏幕位移 < 1.5px 不写 style；统一 `transform: translate3d()`，**禁止对该元素用 CSS transition**（H4 的延伸）。

---

## 4. UI 极简科技风面板

### 4.1 布局分层

| 层 | 元素 | 规则 |
|---|---|---|
| 0 | `canvas#c-scene` | `position:fixed; inset:0`，`touch-action:none` |
| 1 | `#ui-root` | `position:fixed; inset:0; pointer-events:none` |
| 2 | `#ui-boot` | 加载进度 0→1，完成后 `[data-done]` 淡出 |
| 3 | `#ui-top` | 顶部核心数据条，`pointer-events:none`（纯展示） |
| 4 | `#ui-dock` | 底部按钮组，`pointer-events:auto`，单个委托监听 |
| 5 | `#ui-card` | 右侧信息卡，隔离时滑入 |
| 6 | `#ui-toast` | 降级/错误提示（`file://`、无 WebGL2） |

### 4.2 顶部指标（6 常显 + 2 动态）

常显：车长 5.63 m｜轴距 3.40 m｜车宽 1.90 m｜离地 75 mm｜质量 768 kg｜三角面数（实测）
动态（10Hz，出自 §5.6 公式）：**下压力 kg**｜**风阻 CD**｜**等效 L/D**
右上角：`DEMO` 徽标常驻 + 帧率（10Hz）。

### 4.3 设计令牌

```css
--bg:#05070a; --panel:rgba(12,17,24,.72); --ink:#e6edf6; --dim:#7c8ba0;
--accent:#2bff9a; --warn:#ff5566; --line:rgba(255,255,255,.08); --r:2px;
--font:"Inter",system-ui,"Segoe UI",sans-serif;
--mono:ui-monospace,"SF Mono",Consolas,monospace;
```

风格铁律：直角(2px)、1px 描边、`backdrop-filter: blur(14px) saturate(1.2)`、数值 mono + `font-variant-numeric: tabular-nums`、指标标签 9px 大写 `letter-spacing:.14em`。
禁止：圆角 > 4px、彩色阴影、渐变彩色大块、emoji、blur > 24px。

### 4.4 交互与快捷键

| 键 | 动作 | 按钮文案 |
|---|---|---|
| `1` | 外观视图 | 外观视图 |
| `2` | 气流视图 | 气流视图 |
| `D` | DRS 开/关 | DRS ⌁ |
| `Esc` | 退出隔离 | ← 返回整车 |
| `R` | 复位（清隔离 + 回默认机位） | 复位 |
| `H` | 隐藏/显示 UI | — |

- 按钮必须有 `:focus-visible` 描边；DRS 与视图按钮用 `aria-pressed` 表达状态。
- 事件委托：`#ui-dock` 上单个 `click`，读 `e.target.closest('[data-act]')`。
- 移动端 `@media (max-width:720px)`：顶栏折叠为 3 项（车长/下压力/质量），dock 变两行图标 + 文字。

### 4.5 更新纪律

每帧允许写的只有：`#ui-fps` 文本、热点 `transform`。其余一律事件驱动。
**禁止每帧读 `offsetWidth/offsetHeight/getBoundingClientRect`**（强制重排，直接掉帧）。
窗口 `resize` → debounce 80ms → `renderer.setSize` + `camera.aspect` 更新。

---

## 5. 渲染循环与性能约束

### 5.1 单帧唯一合法顺序

```js
function onFrame(t) {
  requestAnimationFrame(onFrame);
  // 1. 时间
  dt = Math.min((t - last) / 1000, 0.05); last = t;
  if (document.hidden) return;
  // 2. 输入：只消费标记，不重复拾取
  if (ptr.dirty) resolvePointer();
  // 3. 状态：阻尼收敛（相机 / DRS / 材质高亮）
  updateTweens(dt);
  // 4. 物理（解析）：只写 uniform，不碰几何
  updateAero(dt);
  // 5. 控制器
  controls.update();
  // 6. 提交
  renderer.render(scene, camera);
  // 7. 覆盖层：10Hz 数值 + 热点投影（frame % 2 分摊）
  updateOverlay();
}
```

禁止：在第 3~6 步之间写 DOM（打断提交节奏）、在第 7 步做几何操作。

### 5.2 渲染器配置

```js
renderer = new WebGLRenderer({ canvas, antialias: (quality === 0),
                               powerPreference: 'high-performance', alpha: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, [2, 1.5, 1][quality]));
renderer.toneMapping = ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = SRGBColorSpace;
renderer.shadowMap.type = PCFSoftShadowMap;   // 仅 quality === 0 启用，mapSize 1024
```

**不用后处理链**（EffectComposer 多一个 CDN 依赖 + 半帧开销）。「科技感」用 CSS 叠加层实现：径向暗角 + 2px 扫描线（`repeating-linear-gradient`，`opacity:.05`），零 GPU 成本。

### 5.3 气流粒子（GPU、无状态、无 ping-pong）

- 载体：`LineSegments`，默认 **1800 条**（3600 顶点），每条一个流线短段。
- 属性：`aSeed`(vec3 入口随机点)、`aPhase`(float 0..1)、`aLen`(0.35..1.2)、`aSide`(±1 头/尾顶点)。
- 流场域：入口盒 `x∈[-1.6,1.6]`、`y∈[0.05,1.5]`、`z=+4.0` → 出口 `z=-6.5`。
- 主干（无状态回绕，不真积分）：

```
z = wrap(z0 - uSpeed*uTime, zExit, zEntry)
p = vec3(x0 + d.x, y0 + d.y, z)
```

- 位移场 `d(p)`（在种子点准静态求值，三次项）：

| 项 | 公式 | 说明 |
|---|---|---|
| 尾迹亏损 | `w = A·exp(-(dx²/2σx² + dy²/2σy²))`，`σ = σ0 + k(zW − z)`，`A = 0.55·uSpeed·(1 − 0.35·uDrs)` | 尾翼后速度亏损，向下游扩散 |
| 翼尖涡对 | `vθ = Γ/(2πr)·(1 − e^(−r²/rc²))`，`Γ = 3.2(1 − 0.45·uDrs)`，`rc = 0.07` | **Rankine 涡核**避免 1/r 奇点；两侧旋向相反，涡核 `(±0.95, 1.02, zWing)` |
| 扩散器上洗 | `dev = 0.25·uSpeed·exp(−((z−zDiff)²/0.6))·smoothstep(...)` | 底板出口气流抬升 |

- 速度着色：`u = |v|/uSpeed` → 三段色带（慢 `#39e0ff` → 中白 → 快 `#ffb86b`）。
- 混合：`AdditiveBlending`、`depthWrite=false`、`depthTest=true`（保证被车体正确遮挡）。
- 透明度：`alpha = smoothstep(0,0.08,phase) * pow(1-phase, 1.4)`（头部亮、尾部消散）。
- DRS 只改 uniform（`A / Γ / 涡核 y`），**绝不重建 geometry**。

### 5.4 为什么不走 GPGPU ping-pong（决策留档）

单文件、无后处理、1800 粒子预算下，每帧两次全屏 RT pass 的成本大于收益；准静态场近场偏折正确，远场差异在 3 秒后已出视野。此结论写入代码注释，防止后来者重写。

### 5.5 DRS / 主动气动（2026 前后双翼）

- `tween.drs` 阻尼 λ = 9，`uni.uDrs = tween.drs`。
- 几何：存在 `REAR_WING_FLAP` → 绕自身铰链轴（取 bbox 后缘上方，局部 `rotation.x`）转 **−22° × tween**；存在 `FRONT_WING_FLAP` → **+6° × tween**。
- 退化：flap 部件缺失 → 仅保留 shader + UI 效果，不报错、不阻塞状态机。
- DRS 在两种视图下都可见（外观视图里能直接看到翼片动起来，这是核心卖点）。

### 5.6 演示数据（唯一来源 `DEMO`）

```js
const DEMO = {
  rho: 1.225, Aref: 1.5, g: 9.81,
  CD: t => 0.92 - 0.30 * t,      // t = tween.drs
  CL: t => 2.15 - 0.58 * t,
  speed: (sec) => 62 + 18 * Math.sin(2 * Math.PI * sec / 17),  // m/s，≈158–288 km/h
};
DF_kg   = 0.5*rho*V*V*Aref*CL(t) / g;
Tdrag_N = 0.5*rho*V*V*Aref*CD(t);
LDR     = DF_kg*g / Tdrag_N;
```

全部 10Hz 采样、取整；UI 常驻 `DEMO` 徽标。**这些数字不得出现在任何对外结论里。**

### 5.7 性能预算与自适应阶梯

| 项 | 预算 | 测法 |
|---|---|---|
| drawcalls | ≤ 90 | `renderer.info.render.calls` |
| 三角面 | ≤ 500k | `renderer.info.render.triangles` |
| GPU 帧 | ≤ 11 ms @1080p | 帧时间 EMA |
| JS 帧 | ≤ 4 ms | `performance.now()` 差值 |

监控：`EMA_ft`（α=0.1，满 90 帧才生效）；`ft > 20ms` → quality↓（2s 冷却）；`ft < 12ms` 连续 300 帧 → ↑（带回滞，防抖动）。

| 档 | dpr | 粒子 | 阴影 | 描边 | 热点标签 | 环境贴图 |
|---|---|---|---|---|---|---|
| Q0 | 2 | 1800 | 开 | 开 | 开 | 开 |
| Q1 | 1.5 | 1200 | 关 | 关 | 开 | 开 |
| Q2 | 1 | 700 | 关 | 关 | 关 | 关 |

其他：`visibilitychange` → 停 rAF 并复位 `last`（防 dt 暴涨）；进入 READY 前先 `renderer.compile(scene, camera)`（首帧避免 200ms 卡顿）。

---

## 6. 失败与降级矩阵

| 故障 | 检测 | 处理 | 用户可见 |
|---|---|---|---|
| three CDN 不可达 | module import reject / `window.onerror` | 捕获后插静态降级页 | 「网络受限」说明 + 纯 CSS 静态图 |
| 无 WebGL2 | `renderer` 构造抛错 | 同上 | 明确提示 |
| glb 404 / 解析失败 / 12s 超时 | `Promise.race` reject | 程序化降级车 + `MODEL_FAIL` | boot 层黄字警告，功能全可用 |
| `file://` 直开 | `location.protocol === 'file:'` | 直接走降级车 | 提示「请用本地服务器以获得完整模型」 |
| 部件全 `UNRESOLVED` | classify 后 `MISC.tri` 占比 > 80% | warn + `console.table` | 单件隔离仍可用 |
| 触屏 | `pointerType === 'touch'` | 跳过 hover，单击即隔离 | 正常 |
| 高 DPI 掉帧 | EMA 阈值 | 阶梯降级 | 无感 |
| resize 到 0 宽 | `w <= 0 \|\| h <= 0` | `clamp(..., 1, ...)` | 无闪屏 |

---

## 7. 单文件骨架与验收

### 7.1 骨架（自上而下顺序固定，便于 review）

```
<!doctype html><html lang="zh-CN"><head>
  <meta viewport> <title>
  <style> 令牌 → 布局 → 面板 → 卡片 → 提示 → 响应式 </style>
  <script type="importmap">{"three":"…/three@0.187.0/build/three.module.js",
                           "three/addons/":"…/three@0.187.0/examples/jsm/"}</script>
</head><body>
  <canvas id="c-scene"></canvas>
  <div id="ui-root"> boot / top / dock / card / toast / legend </div>
  <script type="module">
    §A 常量：PARTS / DEMO / CAM / COLORS
    §B 工具：clamp lerp dampDamp normalize wrap download
    §C 状态机：appState / dispatch / applyEffects / assertInvariants
    §D 场景：renderer / scene / camera / lights / env / controls
    §E 模型：load → normalize → anatomize(classify) → buildPartRoots → fallbackCar
    §F 交互：ptr / resolvePointer / isolate / focusCamera / fillCard
    §G 气流：shader / geometry / uniforms / updateAero
    §H UI：bindUI / keyboard / resize / overlay
    §I 循环：onFrame / adaptiveQuality
    §J 启动：bootstrap()
  </script>
</body></html>
```

估算 1100–1500 行。§E、§G 各自不得超过 300 行 —— 超了说明设计漏了一块，回来改 SDS。

### 7.2 验收清单（写代码时逐条自测，不许口头通过）

1. 本地服务器打开，console 零 `error`（warn 允许且必须解释）
2. **删掉/改坏 glb 仍能完整演示**（降级车）
3. 点任一部件 → 其余全隐、相机 1.2s 内收敛、卡片有内容
4. `Esc` 退出 → 可见性逐个与快照比对一致，无残留隐藏
5. 气流视图 → 粒子被车体遮挡、无闪烁、DRS 开时尾迹变窄变直
6. DRS 切换 → 翼片角度与数字同步（≤ 100ms 感知延迟）
7. 隔离中切气流视图 → I1 生效（自动退出隔离，不卡死）
8. 快速连点 10 次 → 无过渡抽搐（token 生效）
9. 拖拽旋转不误触发隔离（6px / 400ms 阈值）
10. 1080p 稳态 60fps；降到 Q2 后 ≥ 50fps
11. 连续 5 分钟内存无增长（验证 H4）
12. `file://` 直开 → 显示降级提示，不白屏

### 7.3 反模式（出现即返工）

- ❌ 每帧 `new Vector3()` / `new Box3()` / `new Color()`
- ❌ 每帧 `scene.traverse` / `getObjectByName`
- ❌ 用 `mesh.visible = false` 做隔离（破坏状态恢复，必须走 `partRoot`）
- ❌ 直接改共享材质 `emissive`（必须 clone）
- ❌ 在 `pointermove` 里同步 raycast
- ❌ 物理引擎 / 后处理链 / 第三方 UI 库 / Tween 库
- ❌ 给热点标签加 CSS `transition`（每帧 transform 会互相打架）
- ❌ 每帧写 DOM 文本（除 FPS 与热点 transform）
