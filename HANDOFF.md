# HANDOFF — f1-aero

> 最后更新：2026-11-28（发布提交 `12e116e` 之后的交接稿）
> 线上：https://jklin6632-dot.github.io/f1-aero/ ｜ 仓库：`jklin6632-dot/f1-aero`（`main`）

## 这是什么

Ferrari SF-25 的交互式图鉴 + 可在浏览器里操作的风洞工作台。**整个站点是一个 `index.html`**（约 14.2 千行、CRLF 换行），3D 场景用 Three.js（importmap 从 `vendor/` 取），没有构建工具、没有框架。

## 目录

| 路径 | 作用 |
|---|---|
| `index.html` | 站点全部源码（HTML + CSS + ES module） |
| `deploy/` | `mkdeploy.mjs` 产物，**gitignored**，不进仓库 |
| `docs/` | GitHub Pages 根目录（真正上线的内容） |
| `img/` | 站点图片；`img/og.jpg` 是社交分享图（1200×630） |
| `vendor/fonts/` | Archivo / Inter / Space Grotesk 可变字体 |
| `sf25.glb` | 源模型 41.5 MB（仓库里就是这个） |
| `_probe/` | 探针脚本与截图，**gitignored**，跑完不用清理得那么勤 |
| `serve.mjs` | 本地静态服务器，默认 8141 |
| `deploy.zip` | 打包产物，gitignored |

## 发布链（必须按顺序）

```powershell
node _probe/mkdeploy.mjs        # 1. 生成 deploy/，输出须含 meshopt? true | url ok? true
# 2. 同步 deploy/ → docs/（保留 docs/preview.jpg）：
Copy-Item deploy/index.html docs/index.html -Force
robocopy deploy/img docs/img /MIR
robocopy deploy/vendor docs/vendor /MIR
node _probe/mkzip.mjs           # 3. 打 deploy.zip
# 4. 提交（git 不在 PATH，用 GitHubDesktop 内置的）
& 'C:\Users\21530\AppData\Local\GitHubDesktop\app-3.6.11\resources\app\git\cmd\git.exe' add index.html docs/ img/og.jpg .gitignore
& '...git.exe' -c user.name='f1-aero' -c user.email='noreply@example.com' commit -m "..."
# 5. 推送 + 比对
& '...git.exe' -c http.version=HTTP/1.1 push origin main
& '...git.exe' ls-remote origin refs/heads/main
```

- `mkdeploy.mjs` 会把 `sf25.glb` 压成 `docs/sf25.web.glb`（prune + WebP 纹理，41.5 MB → 22.4 MB），并把 `vendor/fonts/` 下**所有** `.woff2` 搬过去（早期写死两个字体名，导致线上一直没有 Archivo，已修）。
- push 偶尔失败，重试 3–8 次；Pages 更新有 1–3 分钟延迟。
- 浏览器里看线上还是旧版时，`Ctrl+Shift+R` 强刷。

## 冻结区（用户明确要求不要动）

1. **流场**：`FLOW` / `stepFlow()` / `respawnParticle()` 与流线材质（`LineBasicMaterial + onBeforeCompile`）：粒子数、线宽、`opacity 0.46`、`mix(0.06,1.0,vHead)`、`SEG_MAX 0.85`、颜色映射、深度淡出 —— 都不要改，也不要加显示开关。
2. **工作台暗场配色**：`APP.setToneMode('tunnel')` + §V10 那套（`#0a0d12` 背景、`0x0a0e14` 地面、`0x9db0c4` 网格、ACES、光池 opacity .22）。

## 结构

- 官网 9 章（`#ch-hero/spec/aero/hot/season/drivers/history/gallery/cta`），`#snav button[data-go="0..7"]` + 分页器 `#pg-prev/#pg-next`。
- 4 个弹层：`#racebox`（战报，含 `‹ ›` 与 ←/→）、`#techbox`（技术单）、`#drvbox`（生涯）、`#lbox`（画廊灯箱）；另有 `#toc` 目录与 `#about` 关于。
- 部件章六步导览：`#hot-steps` 步骤条 + 编号红点 `.hs-n`，`hotStep(k)` 换机位，Esc 回总览，文字块由 `hotNudge()` 在可能被圆点压住时整体上移。
- 工作台 5 个视图：`["exterior","speed","smoke","cp","floor"]`，左侧 `#views` 栏（`[` 键收起），求解报告 `#solve`，底部 `#keys`。

## 已知限制 / 待办

- **冷启动约 6–11 s**：22.4 MB 的 GLB 下载占绝大部分；再快只能降纹理分辨率（会掉画质）。
- **手机端适配未做**（用户明确暂缓）。
- `docs/preview.jpg` 是旧版截图，未更新。
- 战报里沙特 / 西班牙 / 美国三站用的是**别站领奖台照片**，图注已标「示意图」；要换真图去 Wikimedia Commons 找 CC 授权版本。
- 气动章（官网）文案没提烟线视图，属可选补充。
- 「点完表面压力再回外观，悬挂异常」：多次自动探针未复现（材质还原、顶点色泄漏、隐藏对象、覆盖层都正常），需要用户整屏截图才能定位。

## 开发守则（都是踩过的坑）

1. `index.html` 是 **CRLF**：脚本改它要 `split('\r\n').join('\n')` 处理、写回时还原；插入新行时注意别混用 LF。
2. **补丁脚本先断言全部命中，再一次性写盘**。若在 `writeFileSync` 之前 `process.exit(1)`，前面命中的替换一条都不会落盘（曾白跑一轮还以为改好了）。
3. `_probe/*.js` 一律用 write 工具或 node 写 UTF-8；**不要**用 PowerShell 的 `Set-Content -NoNewline` 管道（会把多行文件压成一行，曾把烟线段文件毁过一次，靠从 index.html 里抽回来才救活）。
4. PowerShell 控制台按 GBK 打印 UTF-8 中文会花屏，**看到的乱码不代表文件坏了**；要看内容用 read 工具或 node 读。
5. 键盘监听必须判断 `document.body.classList.contains('mode-work')`，否则官网里按 Q/Z/E/F/WASD 会触发工作台功能（已修过一次）。
6. `#hot` 热区（`z-index:62`）永远压在章节文字（`z-index:2`）之上，和文字避让靠 `hotNudge()`；改动机位或文字块宽度后要复测 `overH2`。
7. 局部变量（`RACES` / `HS` / `SMOKE` 等）都在闭包里，外部驱动只能用 DOM 点击，不能直接访问。
8. 新增 `id` 前先 grep 全站（`#specs` 曾被撞名）。

## 回归脚本（`_probe/`，都需要本地 `node serve.mjs` 在跑）

| 脚本 | 用途 |
|---|---|
| `fullsweep.mjs` | 全站 + 工作台交互巡检（异常/警告/4xx） |
| `stress.mjs` | 连点导航、连按 Esc、热区连点 |
| `resize.mjs` | 工作台改窗口尺寸 |
| `buildsmoke.mjs` | 对 `docs/index.html`（上线产物）冒烟 |
| `live9.mjs` | 对线上 URL 验收 |
| `verify15.mjs` | 部件章导览（k0 / 下一 / Esc） |
| `wbverify.mjs` | 工作台五项（报告/按键条/提示/左栏/悬停） |
| `smokecheck.mjs` | 烟线正式构建冒烟（无调试钩子） |
| `smokeperf.mjs` | 帧率与构建耗时（支持 CPU 降频模拟） |
| `deadcls.cjs` | 扫「只在 CSS 里出现的类」（死样式） |
