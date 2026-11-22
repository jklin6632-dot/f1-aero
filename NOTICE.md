# 第三方资产与商标说明（NOTICE）

本仓库**自己写的代码**使用 MIT 许可证（见 LICENSE）。下面这些内容不是本项目原创，
各自遵循原有许可证，使用时请保留相应署名。

## 1. 3D 模型 `sf25.glb` / `docs/sf25.web.glb`

- 作品：**Ferrari SF-25**
- 作者：**Abu Saif**（Sketchfab）
- 来源：https://sketchfab.com/
- 许可证：**CC BY 4.0**（知识共享 署名 4.0 国际）
- 说明：可以复制、分发、修改、商用，但**必须署名**并注明许可证，且需说明是否做过修改。
  本项目的修改：用 gltf-transform 做了 `prune`（删未引用资源）与贴图 PNG→WebP 转换，
  几何未量化、网格与材质命名保持原样。

`docs/sf25.web.glb` 是同一模型为网页加载重新打包的版本（约 22 MB，原版约 40 MB）。

## 2. three.js（`vendor/three/`）

- 作者：three.js authors
- 许可证：**MIT**
- 说明：`vendor/three/build/three.module.js`、`three.core.js`、`examples/jsm/**` 为官方发行文件，
  文件内已保留版权声明，请勿删除。

## 3. 字体（`vendor/fonts/`）

- **Inter** — SIL Open Font License 1.1
- **Space Grotesk** — SIL Open Font License 1.1
- 说明：两个可变字体 woff2 已按 latin 子集自托管，OFL 允许嵌入与再分发，
  但**不得单独售卖字体本身**，修改后也不得沿用原字体名（Reserved Font Name）。

## 4. 照片（`img/` 与 `docs/img/`，共 18 张）

全部取自 **Wikimedia Commons**，逐张列明作者与许可证。
**图面上没有添加任何水印**；署名统一放在每张图下方的图注里（队史小窗在右下角、
车手/赛季在卡片内），可点击跳到对应的 Commons 文件页。

| 文件 | 内容 | 作者 | 许可证 |
|---|---|---|---|
| `h1950.jpg` | 1949 罗马大奖赛，Ferrari 166 F2 双车 | Unknown photographer | Public domain |
| `h1961.jpg` | Ferrari 156（伦敦 F1 展览） | Hullian111 | CC BY-SA 4.0 |
| `h1979.jpg` | Ferrari 312 T4，Scheckter，1979 比利时站 | Martin Lee | CC BY-SA 2.0 |
| `h2004.jpg` | Ferrari F2004 | emperornie | CC BY-SA 2.0 |
| `h2008.jpg` | Ferrari F2008 | Calreyn88 | CC BY-SA 4.0 |
| `h2023.jpg` | Carlos Sainz，2023 意大利站 | Eustace Bagge | CC BY-SA 4.0 |
| `h2024.jpg` | SF-24，2024 日本站 | Cineyas | CC BY-SA 4.0 |
| `h2025.jpg` | Charles Leclerc，SF-25，2025 日本站 | Liauzh | CC BY-SA 4.0 |
| `p16.jpg` | Charles Leclerc，2025 奥地利站 | Lukas Raich | CC BY-SA 4.0 |
| `p44.jpg` | Lewis Hamilton，2025 日本站 | Liauzh | CC BY-SA 4.0 |
| `r08.jpg` | Lewis Hamilton，2025 摩纳哥站 FP2 | Riottoso | CC BY 4.0 |
| `r13.jpg` | Lewis Hamilton，2025 比利时站周末 | Skyebble | CC BY 4.0 |
| `s1.jpg` | Charles Leclerc，2025 新加坡站 | Liauzh | CC BY-SA 4.0 |
| `s2.jpg` | Lewis Hamilton，2025 新加坡站 | Liauzh | CC BY-SA 4.0 |
| `pod_a.jpg` | Charles Leclerc 举奖杯，2022 奥地利站领奖台 | Lukas Raich | CC BY-SA 4.0 |
| `pod_b.jpg` | 领奖台喷香槟，2024 荷兰站（Leclerc 在左） | Steffen Prößdorf | CC BY-SA 4.0 |
| `pod_c.jpg` | Charles Leclerc 正面，2024 荷兰站领奖台 | Steffen Prößdorf | CC BY-SA 4.0 |
| `ham25.jpg` | Lewis Hamilton，2025 日本站车迷区（车手卡 + 墨西哥城站卡片） | Liauzh | CC BY-SA 4.0 |

`pod_a/pod_b/pod_c` 是 **2022 / 2024 年的领奖台照**，`ham25.jpg` 是 2025 日本站车迷区照，
都不是 2025 赛季那 7 次登台的现场图（Commons 上没有其中 4 站的现场照）——页面里凡是用到
它们的卡片和图注都标了「示意图（非本站实拍）」，没有把它们说成当站实拍。

CC BY-SA 的要求是 **署名 + 许可证 + 标明是否修改**：
本项目只做了等比缩放与 JPEG 重压缩（长边 ≤1600 px、q78–84），没有裁剪内容、没有加滤镜、没有加水印。
如果转发或再发布这些照片，请沿用上表的署名与许可证，并保留 CC BY-SA 的传染性条款。

## 5. 商标与赛事素材（重要）

`sf25.glb` 的贴图里包含法拉利车队标识、跃马盾徽、车号 16/44、赞助商 logo
（Shell、Pirelli、AWS、HP、Richard Mille、UniCredit、V-Power、Puma、Brembo、Mahle 等），
以及页面文案引用的 FIA 技术规则、2024 赛季车身尺寸等公开信息。

- 这些**商标与标识归各自权利人所有**，不在本仓库任何许可证的授权范围内；
- 本仓库用于**技术演示与学习**，与 Ferrari、FIA、Formula 1 及各赞助商**无隶属关系**；
- 如果你要**商用**（含付费课程、广告变现、客户交付），请自行评估商标风险，
  或替换为自建模型 / 无标识素材；
- 页面里的气动数值是 VLM 涡格法近似解，**不是 CFD 结果**，不能作为工程依据。

## 6. 一个提醒

开源不等于放弃署名：别人用你的代码时，MIT 要求保留你的版权声明；
用这个模型时，CC BY 要求署名 Abu Saif。两边都请照做。
