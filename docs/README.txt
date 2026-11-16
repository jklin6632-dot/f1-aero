F1 AERO — 可分享的压缩版（分享用，不是开发副本）
==================================================

这个目录是把主项目（..\index.html + sf25.glb 41.5 MB）压成「能发链接给朋友」的版本：
模型 41.5 MB → 22.4 MB，整个目录 25 MiB。功能一个不少。

文件
----
index.html                     页面本体（单文件，含全部逻辑与样式）
sf25.web.glb                   压缩后的模型（prune 删冗余 + 贴图 WebP q90；几何保持 float32，未量化）
vendor/three/build/            three.js r187（three.module.js + three.core.js，两个都要）
vendor/three/examples/jsm/     OrbitControls / RoomEnvironment / GLTFLoader / meshopt 解码器
vendor/fonts/                  Inter + Space Grotesk（自托管，离线可用）
serve.mjs                      本地静态服务器（零依赖，Node ≥ 18）
start.cmd                      Windows 一键：起服务器 + 开浏览器（双击即可）


本地预览
--------
方式一：双击 start.cmd（Windows）
方式二：命令行  node serve.mjs 8080  然后开 http://127.0.0.1:8080/
必须走 http：模型用 fetch 加载，file:// 会被 CORS 拦。


发布成链接（任选其一）
----------------------
1) 腾讯 EdgeOne Pages（国内访问最稳，免备案）—— 首选
   控制台 → Pages → 新建项目 → 直接上传本目录（单文件上限 25 MB，本目录最大文件 22.4 MB，够用）
   得到 https://<项目名>.edgeone.app 之类的地址，发这个就行。

2) Netlify Drop（最省事，国际线路）
   打开 https://app.netlify.com/drop ，把整个 deploy 文件夹拖进去。
   注意：官方建议单文件 < 10 MB，我们这个是 22.4 MB，网页版拖拽有可能卡在 Uploading；
   卡住就走 Netlify CLI（npm i -g netlify-cli && netlify deploy --prod --dir .）。

3) Vercel：vercel --prod（或网页版拖拽），同上。

4) GitHub Pages：适合「开源 + 顺便有个地址」，但 github.io 在国内时通时不通，
   不建议拿来发朋友圈；仓库里用 Git LFS 或 Release 附件放 glb。

注意：以上平台都是静态托管，本目录不要再压缩成 zip 上传（要传解压后的文件）。


浏览器要求
----------
WebGL2 + WebP：Chrome / Edge 88+、Safari 14+（iOS 14+）、Firefox 90+。
老机器 / 微信内置 X5 内核可能不支持 WebGL2，会停在加载提示上——这是 three r187 的硬要求，不是 bug。


压缩方法与代价（想重做时用）
----------------------------
用 @gltf-transform/cli 4.x 分两步（不要用一条 optimize，它会把 229 个网格合成 26 个、
并把 FERRARI_STEERINGWHEEL_DECAL 并进别的材质，页面靠网格名/材质名认部件，会全乱）：

  gltf-transform prune sf25.glb t1.glb                          41.49 → 34.66 MB
  gltf-transform webp  t1.glb  t2.glb --quality 90 --effort 5   → 22.36 MB

为什么不再加一步 meshopt（能到 9.7 MB）：
meshopt 会顺带做 KHR_mesh_quantization，把 POSITION 变成 Int16 + normalized，
顶点在 JS 里读到的是整数域（±32767）而不是真实坐标。本页的 Q 视图（方向盘拆解）、
Z 视图（按世界 z 切片）、部件隔离都直接读顶点坐标，量化后这些功能会算错/报错，
所以这里保留 float32。要更小就得先把解码后的属性反量化（或改这些取点逻辑），属于后续优化。

贴图改成 WebP q90 是唯一有损的一步。实测同机位对比：平均每通道差 0.71/255，
1.2% 的像素差超过 8（基本都是抗锯齿边缘），肉眼看不出来；需要更狠的保真就把 --quality 提到 95（体积约 +25%）。


素材与许可
----------
3D 模型：Ferrari SF-25 by Abu Saif（Sketchfab）— CC-BY 4.0，转发/二次分发请保留署名。
气动数值：VLM 涡格 + 地面镜像近似解，不是 CFD，仅作演示。
车型与赞助商标识属各自权利人，仅供个人展示，不要商用。
