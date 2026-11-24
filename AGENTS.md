# f1-aero 工作区约定（Agent 必读）

> 站点：`index.html`（单文件，CRLF 换行）→ `_probe/mkdeploy.mjs` 生成 `deploy/` → 同步 `docs/` → `_probe/mkzip.mjs` 打 `deploy.zip` → push，GitHub Pages 发布。
> git 不在 PATH：`C:\Users\21530\AppData\Local\GitHubDesktop\app-3.6.11\resources\app\git\cmd\git.exe`

## 冻结区：**不要再动**

以下是用户明确认可、并要求保持不动的部分。任何改动前必须先问，得到明确同意才动手。

### 1. 流场可视化（速度场）——2026-11-24 用户确认「完美」
`index.html` 里 `FLOW` / `stepFlow()` / `respawnParticle()` / 流线材质（`LineBasicMaterial` + `onBeforeCompile`）这一整套，视为定稿：

- 粒子数量（`FLOW.N`）与线宽：不动
- 基础透明度（当前 `0.46`）、`aHead` 头亮尾暗比例（`mix(0.06, 1.0, vHead)`）：不动
- `SEG_MAX` 段长封顶（0.85 m）：不动
- 颜色映射、深度淡出（`uFadeNear/uFadeFar`）：不动
- **不要**加任何新的显示开关（切面、抽稀、密度档位等）——切面开关用过一次，用户判断「影响效果」已删除（提交 `28af9c7`）

历史教训：曾把 `opacity` 从 0.38 提到 0.62（为了在暗底上更亮），300 km/h 时线段叠加成一团，被用户当场否掉；曾做 `keep` 抽稀，被否掉（「抽稀完就不真实了」）。两者的最终取舍就是现在这版。

### 2. 工作台暗场配色
`APP.setToneMode('tunnel')` + §V10 那套（`#0a0d12` 背景、`0x0a0e14` 地面、`0x9db0c4` 网格、ACES、光池 `opacity .22`、`wb-dark` 类）为用户验收过的观感，不要顺手"优化"。

## 发布前必做

1. `node _probe/mkdeploy.mjs`（必须在仓库根目录跑，输出要看到 `meshopt? true | url ok? true`）
2. 同步 `deploy/` → `docs/`（保留 `docs/preview.jpg`）
3. `node _probe/mkzip.mjs`
4. commit + `git -c http.version=HTTP/1.1 push origin main`（常失败，重试 3–8 次）
5. `git ls-remote origin refs/heads/main` 与本地 HEAD 比对，再 fetch 线上页面核对关键标记

## 已知坑

- `index.html` 是 CRLF：多行锚点先 `.split("\r\n").join("\n")` 再替换，写完还原
- 新增 `id` 前先 grep 全站，`#specs` 曾被撞名把技术规格压成一列
- `body.mode-work #solve{top:360px}` 这类带 `body.` 前缀的规则优先级更高，覆盖时必须带同样前缀
- Headless Edge 里 `Input.dispatchKeyEvent` 长按经常不生效，用 `window.dispatchEvent(new KeyboardEvent('keydown',{key:'w'}))` 驱动油门
