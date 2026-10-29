# Video Studio

独立、开源的浏览器视频生成工作台，适用于 A6API 和提供 OpenAI 兼容视频接口的服务。单条生成与批量生成共用模型配置、文件输入和任务队列。

无需账号系统、代理或安装后端；没有远程脚本、遥测或运行时依赖。

## 直接使用

[下载 v0.1.1 使用包](https://github.com/cryptoplayer90/video-studio-tool/releases/download/v0.1.1/video-studio-0.1.1.zip) · [查看全部版本](https://github.com/cryptoplayer90/video-studio-tool/releases)

1. 解压构建包，使用最新版 Chrome、Edge 或 Safari 打开 `index.html`。
2. 填写 API Base URL 和自己的 API Key。地址可以包含 `/v1`，工具会统一处理。
3. 点击“刷新模型”，选择品牌及模型。内置 A6API 目录为 **2026-10-29 的 21 个模型快照**，不是实时可用性保证。
4. 填写提示词，按需选择配置和本地素材，点击“预览并生成”。
5. 核对最终请求和 API 地址，确认后才提交。任务完成后可以预览及下载。

生成可能产生实际费用。“停止轮询”只停止本地查询；“停止提交”只移除尚未发送的请求。两者都无法取消供应商已收到的任务或费用。网络中断、错误和未知状态都不会自动重发生成请求。

如果直接打开文件受到浏览器限制，也可在源码目录使用 `npm run dev`，打开 `http://127.0.0.1:4186`。这个服务仅提供静态文件，不转发 API 请求。

## 模型与配置

- 先选品牌，再选该品牌模型；每个品牌都有“自定义模型”入口。
- 自定义名称需要与 A6API 完全一致，例如 `doubao-seedance-2.5`。圆圈感叹号支持悬停、键盘聚焦和点击查看说明。
- 不支持和能力未知的配置分别解释、默认置灰。“自定义配置”可以解除工具预设限制，允许手动填写时长、分辨率和其他配置；最终能否使用由服务端决定。
- 切换模型或关闭自定义配置后，不适用的参数和文件会清理，不随请求发送。
- 高级 JSON 只补充额外参数，例如 `{"seed":42}`，不能覆盖模型、提示词、时长、分辨率、声音或媒体字段。

目录刷新优先读取 `/api/pricing`，再尝试 `/v1/models`，只采纳明确含有 `openai-video` 端点标记的记录。目录可见不代表当前 Key、分组或供货可用。失败时显示原因并回到标明来源的本地配置；未知品牌不会归为 OpenAI。

预设的品牌、时长默认值与上限参考当前 A6API 清单和时长 profile；规格来自公开的 `video_spec_prices` 键，`any` 是未区分维度，不能用来推断功能不支持。声音和媒体能力不是完整的官方能力声明。

## 本地图片和视频

两种素材都支持多选、拖入多个、分次追加、逐个移除和清空。按确认列表顺序，使用重复的 multipart 文件字段逐个发送；没有媒体 URL 输入框，确认前不会上传。

**当前尚未对 21 个模型逐一完成真实上游本地文件兼容验证。** 因此内置媒体能力标记为“待确认”，默认置灰；可勾选“自定义配置”尝试，或导入你已验证的 Provider 配置。默认图片字段为 `input_reference`，视频字段为 `reference_videos`；具体数量、首尾帧含义和组合能力由目标模型决定。工具不会把网关支持 multipart 当作所有上游均支持的证据，也不承诺超过 2 个参考视频的上游计价结果。

工具安全限制：单文件 200 MiB，每条任务素材合计 500 MiB；图片允许 PNG/JPEG/WebP/GIF/AVIF，视频允许 MP4/MOV/WebM/M4V。这些不是模型上限。批量多行使用相同素材时，每行都会再次上传，注意网络流量和费用。

## 批量文件

支持拖拽或选择 **一个** TXT、JSON 或 CSV 文件，也可以直接粘贴文本。单批最多 20 条，任务文件最大 2 MiB。

- TXT：每个非空行是一条提示词。
- JSON：提示词字符串数组，或包含 `prompt` 的对象数组。
- CSV：必须有 `prompt` 列，可含 `seconds,resolution,audio,images,videos`。
- 品牌、模型和默认配置共用；行内可覆盖上述字段。`audio` 使用 `true` 或 `false`。
- `images` / `videos` 只能引用已经手动选择的本地文件名，JSON 用数组，CSV 用 `|` 分隔；缺失或重名会定位到行并报错。省略则共用已选素材，空数组或空 CSV 单元格表示该行不用对应素材。
- 不能读取本机路径或自动下载远程素材。

示例见 `examples/`。每页面串行提交生成请求，最多 3 个并发状态查询；同槽位、同任务的查询启动至少相隔 5 秒。不同标签页各自计算，工具不承诺跨页面或服务端的全局限额、去重和幂等。

每条任务从第一次状态查询起最多自动查询 30 分钟，单次查询超时 30 秒。网络错误、HTTP 错误或未知状态立即暂停，保留原 task ID。“继续查询”只 GET 原任务，并开启新查询会话；重新生成需要重新确认并发送新的 POST。

刷新只恢复有有效时间、剩余预算和 Key 的正在查询任务；不重置预算，不重发 POST。人工停止或异常暂停的任务等待手动继续。没有保存 Key 时，重新填写原服务的 Key 后点击“继续查询”；未提交的素材需重新选择。

## 兼容服务配置

在“兼容服务配置”中导入 `provider-config.example.json`。配置不包含 API 地址或 Key；地址与鉴权始终由连接输入框提供。导出只保留工具支持的配置字段。

`schemaVersion` 固定为 1，`models` 是非空数组，每个模型需要唯一 `id`。`brand` 为展示品牌，`seconds` 为 `{default,max}` 或 `null`，`resolutions` 为已验证档位数组。`audio`、`media.image`、`media.video` 使用 `true`（支持）、`false`（不支持）或 `null`（未确认）。可选 `maxFiles.image/video` 为已验证数量上限。示例没有宣称媒体已验证。

`fields` 支持映射 `seconds/resolution/audio/image/video`，例如图片字段改为服务文档规定的 `reference_images[]`。`statuses` 可映射 `queued/running/completed/failed` 的字符串数组，四组不能重复。未设置则使用常见 OpenAI 兼容状态。

仅在服务方明确支持时设置 `idempotency: true`，工具会发送每行独立的 `Idempotency-Key`。默认关闭；本地避免重复确认不等于服务端幂等保证。

## 隐私与 CORS

Key 默认只在内存中；主动勾选才写入当前标签页的 `sessionStorage`，从不写入 `localStorage`。任务会话存储只保存摘要、task ID、状态和查询时间，不含 Key、完整请求或文件。深浅色偏好单独存在 `localStorage`。清除 Key 可停止待提交任务、暂停查询并清除会话 Key；已发出请求无法撤回。

Key 和素材只发往你填的 API 地址。不会跟随 API 重定向，也不使用响应中的任意视频 URL；成片通过同一服务的 `/v1/videos/{id}/content` 鉴权获取为本地 blob 播放和下载。配置、错误与请求预览不打印鉴权头；请勿主动把 Key 填进提示词或额外参数。

浏览器直连受目标服务 CORS 和混合内容规则限制；API 需要允许当前网页来源、`Authorization`、`Content-Type` 和相应请求方法。`file:` 打开的来源可能是 `null`；若服务不允许，应使用它允许的网页来源或服务方客户端。工具不关闭浏览器安全设置、不提供代理绕过。仅当启用幂等配置时还需要允许 `Idempotency-Key` 请求头。

## 源码开发

要求 Node.js 22 或更新版本。构建和单元测试零 npm 依赖，无需 `npm install`。

```sh
npm run build       # 自包含 dist/index.html
npm run dev         # 127.0.0.1:4186；修改源码后重新 build
npm test            # Node 内置测试：状态机、文件、队列及 mock 接口
npm run package     # release/ 中的使用包和源码包；需要 Python 3
```

浏览器回归需要 Playwright 1.62.1 及本机 Chrome（仅开发测试依赖）：

```sh
npm install --no-save --package-lock=false playwright@1.62.1
CHROME_PATH="/path/to/chrome" npm run test:browser
```

也可用 `PLAYWRIGHT_MODULE` 指向已有 Playwright 的绝对模块文件。测试启动自己的本地 mock API，不使用真实 Key、不发起付费生成。`CHROME_PATH` 在 macOS 默认为 `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`，Linux 默认 `/usr/bin/google-chrome`。

源码：`src/core.js` 为接口、确认快照、队列与轮询状态机，`src/presets.js` 集中保存模型快照，`src/app.js` 负责界面。构建将本地源码与样式内嵌为一个 HTML；发布时可上传静态文件至自己选择的静态托管服务，不需要 A6API 私有代码或数据库。

## 许可证

MIT。Copyright (c) 2026 币圈90后。X：[@cryptoplayer999](https://x.com/cryptoplayer999)。

完整许可见 `LICENSE`；图标第三方声明见 `THIRD_PARTY_NOTICES.md`。
