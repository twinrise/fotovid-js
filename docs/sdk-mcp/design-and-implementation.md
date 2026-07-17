# Fotovid `@fotovid/sdk` + `@fotovid/mcp` 设计与实现方案

> 状态:**待审核**(方案阶段,未写代码)。
> 目的:把首页 `ServerlessNative.tsx` 上「Typed SDK」和「MCP server」两张卡从广告变成真实可安装的产物。
> 前提:两者都是**现有 HTTP API 之上的薄封装**,不改 fotovid-api 后端。

---

## 0. 决策记录(已拍板)

| 决策 | 结论 | 备注 / 依据 |
|---|---|---|
| 先做什么 | **SDK + 本地 MCP 一起**(用户选 B) | MCP 依赖 SDK,顺序 SDK→MCP |
| 代码放哪 | **新建独立公开仓 `fotovid-js`**(pnpm workspace) | 与 web app、Go API 分离 |
| 发布到哪 | **npm**,命名空间 `@fotovid/*` | SDK 与 MCP 都发 npm |
| MCP 形态 | **本地 stdio**(`npx @fotovid/mcp`)先行 | 托管远程 endpoint 延后 |
| 发布自动化 | **changesets + GitHub Actions** | 先手动发也可 |
| **包名** | **scoped `@fotovid/sdk` + `@fotovid/mcp`** | 要发包家族;npm 官方:scope 用于防抢名/官方背书/归组([npm docs](https://docs.npmjs.com/about-organization-scopes-and-packages/))。现代家族 SDK 皆 scoped(`@anthropic-ai/sdk`、`@aws-sdk/*`、`@supabase/*`) |
| **方法面** | **命名空间式 `client.video.watermark`** | 映射 REST(`/v1/video/*`…);一手:OpenAI `client.chat.completions`、Stripe `stripe.paymentIntents.create`;Stainless:「resource=namespace→class」([Stainless](https://www.stainless.com/docs/guides/configure/)) |
| **参数风格** | **snake_case 直通**(不转 camelCase) | 对 snake_case API 的主流做法;一手:Stripe v19.3.1 参数全 snake_case、无 camel 变体;OpenAI/Anthropic 同。与文档 1:1、类型从 openapi 直接生成、无映射层 |
| **v1 范围** | 含 `probe`;**`download()` 延后** | probe 无额外成本;下载便捷方法保持薄,v2 再加 |
| **License** | **MIT** | OSS SDK 惯例 |

## 剩余待你拍板(见 §9)

- **首页文案时机**:删 transcode / endpoint→server 的措辞修正,**建议随 SDK/MCP 上线一起改(S7)**,发布前保持诚实即可。
- **建仓方式**:你手动建 `fotovid-js` 公开仓给我路径,还是授权我用 `gh repo create` 建 + 本地脚手架?(这是唯一挡开工的动作项)

---

## 1. 背景与目标

- **为什么值得做**:对 API 产品,typed SDK 是**标配**,能把「读文档拼 fetch」降为「装包调方法」,直接降低接入摩擦。MCP tool 则是面向 agent / AI 工具的分发入口,当下低成本高话题度。
- **为什么好做**:难的部分(ffmpeg 处理 + 一份 OpenAPI 3.1 正式契约)**已完成**。SDK/MCP 只是把 `POST {source_url, params}` 包漂亮。
- **Non-goals(明确不做)**:
  - 托管远程 MCP endpoint(多租户 + OAuth/限流 + 运维)——延后。
  - **transcode / convert**——API 根本没有这个端点,首页文案需删。
  - 浏览器端 SDK、Python SDK——以后另开。

---

## 2. 真实 API 契约(SDK 的对齐基准)

来源:`fotovid-api/services/fotovid/api/openapi.json`(Huma 生成,OpenAPI 3.1)。

- **Base URL**:默认 `https://api.fotovid.co`(可通过配置覆盖为 `http://localhost:8080` 等)。
- **鉴权**:`Authorization: Bearer <key>`,key 形如 `p6_<key_id>:<secret>`。
- **通用请求体**:`{ "source_url": string (必填), "params": { ... } }`。
- **通用媒体响应**:

```json
{ "id": "…", "type": "video.watermark", "url": "https://…(presigned)",
  "expires_at": "2026-01-01T00:00:00Z", "duration": 12.3 }
```
`id/type/url/expires_at` 必有,`duration` 可选。**URL 是 presigned、有 TTL,提醒用户自存一份。**

### 端点与参数(逐一,来自 spec)

| 端点 | 方法名(建议) | params |
|---|---|---|
| `POST /v1/video/watermark` | `video.watermark` | `watermark_type`(text\|image\|combo,默认 text)、`text`、`font_size`(8–200)、`font_color`、`watermark_image_url`(uri)、`scale`(0–1)、`opacity`(0–1)、`position`(top-left\|top-right\|bottom-left\|bottom-right\|center,默认 bottom-right)、`padding`(0–500)、`output_format`(webp\|jpeg\|jpg\|png,默认 webp)、`quality`(1–100,默认 80)、`preset`(x264,仅视频) |
| `POST /v1/image/watermark` | `image.watermark` | 同上,**除 `preset`** |
| `POST /v1/video/trim` | `video.trim` | `start`(秒,含)、`end`(秒,不含,须 > start) |
| `POST /v1/video/extract-audio` | `video.extractAudio` | **无 params** |
| `POST /v1/audio/crop` | `audio.crop` | `start`、`end`(同 trim) |
| `POST /v1/video/extract-cover` | `video.thumbnail` | `at`(秒,默认 ~1)、`output_format`、`quality` |
| `POST /v1/video/probe` | `video.probe` | 无 params;**响应特殊**:`{ id, type, width, height, durationSec, fps, codec, hasAlpha }` |

> 说明:account/api-keys、tasks、pricing 等端点 v1 SDK **暂不封装**(首页广告的是媒体处理)。

---

## 3. 仓库结构 `fotovid-js`

```
fotovid-js/                        # 新建公开 GitHub 仓
├─ package.json                    # private:true,workspaces,脚本
├─ pnpm-workspace.yaml             # packages/*
├─ tsconfig.base.json
├─ biome.json                      # 与主项目一致的 tab 风格
├─ .changeset/config.json
├─ .github/workflows/
│  ├─ ci.yml                       # 每 PR:build + typecheck + test
│  └─ release.yml                  # changesets → npm publish (provenance)
├─ LICENSE  README.md  .gitignore
├─ packages/
│  ├─ sdk/                         # → @fotovid/sdk
│  │  ├─ package.json              # exports(ESM+CJS)、types、zero deps、Node>=18
│  │  ├─ tsup.config.ts
│  │  ├─ src/
│  │  │  ├─ index.ts               # 导出 Fotovid、类型、FotovidError
│  │  │  ├─ client.ts              # Fotovid 类 + 资源命名空间
│  │  │  ├─ types.ts               # 由 openapi.json 生成的底层类型 + 封装类型
│  │  │  └─ error.ts               # FotovidError
│  │  ├─ scripts/gen-types.ts      # openapi-typescript 生成(见 §4.1)
│  │  └─ README.md
│  └─ mcp/                         # → @fotovid/mcp
│     ├─ package.json              # bin: fotovid-mcp,dep: @fotovid/sdk + @modelcontextprotocol/sdk + zod
│     ├─ tsup.config.ts
│     ├─ src/
│     │  ├─ index.ts               # #!/usr/bin/env node,启动 stdio server
│     │  ├─ server.ts              # 注册 tools
│     │  └─ tools.ts               # 每个 SDK 方法 → 一个 MCP tool
│     └─ README.md
```

---

## 4. `@fotovid/sdk` 设计

### 4.1 类型策略

- **底层类型从 `openapi.json` 生成**(`openapi-typescript`),spec 是唯一真相源(与项目既有约定一致:改契约时类型自动跟随)。
- 生成产物之上,手写**符合直觉的封装类型**(方法参数、结果对象)。
- 生成脚本读取本地 `openapi.json`(可复用主仓 `sync-openapi.mjs` 的路径约定),`pnpm gen:types` 触发,产物提交入库(离线可 build)。

### 4.2 客户端

```ts
import { Fotovid } from "@fotovid/sdk";

const fotovid = new Fotovid({
  apiKey: process.env.FOTOVID_API_KEY!,   // "p6_<id>:<secret>";缺省读 env
  baseUrl: "https://api.fotovid.co",      // 可选,默认生产
  fetch,                                   // 可选,默认全局 fetch(Node 18+)
});
```

### 4.3 方法面(已定:命名空间式,映射 REST 结构)

> 命名空间/方法名用 camelCase JS 惯例(`video.extractAudio`);**参数键用 snake_case 直通**,与 API/文档 1:1。等于 Stripe 风格:`stripe.paymentIntents.create({ payment_method })`。

```ts
// 视频
await fotovid.video.watermark({
  source_url,
  watermark_type: "image",
  watermark_image_url,
  position: "bottom-right",
  opacity: 0.8,
});
await fotovid.video.trim({ source_url, start: 3, end: 12 });
await fotovid.video.extractAudio({ source_url });
await fotovid.video.thumbnail({ source_url, at: 5 });
await fotovid.video.probe({ source_url });     // → ProbeResult
// 图片
await fotovid.image.watermark({ source_url, text: "© Fotovid", position: "center" });
// 音频
await fotovid.audio.crop({ source_url, start: 10, end: 30 });
```

- 每个方法(除 probe)返回 `MediaResult`(字段名也直通,不改大小写):

```ts
type MediaResult = {
  id: string;
  type: string;
  url: string;            // presigned,有 TTL —— 文档强调「自存一份」
  expires_at: string;     // RFC3339(与 API 一致)
  duration?: number;
};
```

- **参数风格(已定):snake_case 直通** —— 参数键与 API/文档 1:1(`source_url`、`watermark_image_url`),SDK 只把扁平参数重新组装成 wire 的 `{ source_url, params }`,不做 camelCase 转换;类型直接来自 openapi 生成,无映射层。依据见 §0 决策表(Stripe/OpenAI 一手 + Stainless)。
- **返回值也直通**:媒体结果保留 `expires_at`;`probe` 保留 API 原样的 `durationSec`/`hasAlpha`(该 API 两个端点自身大小写就不统一,直通即忠实反映,不做归一)。
- **便捷下载 `download()`(已定:v1 不做,v2 再加)**:`result.download()` / `client.download(url)` 用全局 fetch 拉回 `ArrayBuffer`。v1 保持薄。

### 4.4 错误处理

```ts
class FotovidError extends Error {
  status: number;         // HTTP 状态
  code?: string;          // 后端错误码(若有)
  requestId?: string;     // 便于报障
}
```
非 2xx → 抛 `FotovidError`(解析后端错误体);网络错误透传。不做自动重试(v1 保持薄;可留 `maxRetries` 配置位延后)。

### 4.5 打包

- `tsup` 出 **ESM + CJS + `.d.ts`**;`exports` 双入口;`sideEffects:false`。
- **零运行时依赖**(用全局 fetch),`engines.node >= 18`。
- `files` 白名单只发 `dist` + README + LICENSE。

---

## 5. `@fotovid/mcp` 设计

### 5.1 形态与传输

- **本地 stdio server**,通过 `npx -y @fotovid/mcp` 运行,或客户端配置里常驻。
- 依赖:`@modelcontextprotocol/sdk`(server + stdio transport)、`@fotovid/sdk`、`zod`(tool 输入 schema)。
- 鉴权:读 `FOTOVID_API_KEY` 环境变量,内部 `new Fotovid({ apiKey })`。缺失则启动即报清晰错误。

### 5.2 tools(每个 SDK 方法一个)

| tool 名 | → SDK | 输入(zod) |
|---|---|---|
| `fotovid_watermark_video` | `video.watermark` | source_url + 水印参数 |
| `fotovid_watermark_image` | `image.watermark` | 同上(无 preset) |
| `fotovid_trim_video` | `video.trim` | source_url, start, end |
| `fotovid_extract_audio` | `video.extractAudio` | source_url |
| `fotovid_crop_audio` | `audio.crop` | source_url, start, end |
| `fotovid_video_thumbnail` | `video.thumbnail` | source_url, at?, output_format?, quality? |
| `fotovid_probe_video` | `video.probe` | source_url |

- **tool description 要写好**:agent 靠描述选工具。每个描述点明「输入一个媒体 URL、输出一个成品文件 URL(有 24h TTL,请自存)」。
- 输出:MCP tool result 返回结构化 JSON(含 `url`)+ 一行人读文本(结果链接 + TTL 提醒)。

### 5.3 用户端配置

```jsonc
// Claude Desktop / Cursor 的 mcp 配置
{
  "mcpServers": {
    "fotovid": {
      "command": "npx",
      "args": ["-y", "@fotovid/mcp"],
      "env": { "FOTOVID_API_KEY": "p6_xxx:yyy" }
    }
  }
}
```

### 5.4 分发

- 主渠道:npm(`bin` = `fotovid-mcp`)。
- 被发现:官方 MCP registry、`modelcontextprotocol/servers` 提 PR、Smithery / mcp.so / PulseMCP / Glama 登记。
- 可选:打 `.mcpb` bundle,Claude Desktop 一键安装。

---

## 6. 发布方案

- **npm**:注册账号 → 建免费 `@fotovid` org → 公开包首发 `npm publish --access public`(scoped 默认私有,必须加)。
- **自动化**:`changesets` 管版本/changelog;`.github/workflows/release.yml` 在合并后据 changeset 自动 `npm publish`,开 **npm provenance**。CI 用 `NPM_TOKEN` secret。
- **版本**:semver;SDK 与 MCP 独立版本(MCP 的 peerdep/dep 指向 SDK)。

### 只有你能做的(我做不了)

- 注册 npm 账号 + 建 `@fotovid` org。
- `npm login`(交互 + 2FA)—— 需要时在对话里敲 `! npm login`。
- 生成 `NPM_TOKEN` 存到 GitHub repo secret。
- 新建 GitHub 公开仓 `fotovid-js`(或授权我 `gh repo create`)。

---

## 7. 实施计划(串行,solo)

| # | 步骤 | 产出 | 粗估 |
|---|---|---|---|
| S0 | 建仓脚手架 | workspace + tsconfig + biome + changesets + CI 骨架 | 0.5d |
| S1 | SDK 类型生成 | `gen:types` 从 openapi.json 出底层类型 | 0.5d |
| S2 | SDK 客户端 | `Fotovid` 类 + 7 方法 + 错误 + 打包 | 0.5d |
| S3 | SDK 冒烟测 | 对真实 API 跑通(需测试 key) + README | 0.5d |
| S4 | MCP server | 7 tools + stdio + 鉴权 + 打包 | 0.5–1d |
| S5 | MCP 验证 | MCP Inspector 跑通 + README + 配置示例 | 0.5d |
| S6 | 发布 | 首发 npm(两包)+ 登记 MCP 目录 | 0.5d |
| S7 | 首页联动 | 改 `ServerlessNative.tsx`(见 §8),补真实安装/调用代码 | 0.5d |

合计 ≈ 3.5–4 人日。SDK(S0–S3)可独立先上,MCP(S4–S5)紧随。

---

## 8. 首页文案联动(诚信修正)

**决策(b)已执行:发布前先撤下 vaporware,S7 上线后放真实版。**

- **现在(已改)**:`ServerlessNative.tsx` 撤掉「Typed SDK」「MCP server」两张卡(含错误的「transcode」措辞)。因 3 列网格删 2 张会剩 1 张孤卡,用两张**真实的 serverless-native 能力**补位:
  - 「Runs from any runtime」——无二进制入包 / 无冷启动层,同一 HTTPS 调用在 Vercel/Cloudflare/Lambda/Deno 都行。
  - 「Hosted results, no temp files」——每次返回成品的 presigned URL,不写函数只读盘。
- **S7(包上线后)**:再把 SDK / MCP 卡加回,放真实 `npm i @fotovid/sdk` + MCP 配置,措辞用「MCP server」(非 endpoint)。
- **FeatureGrid 的「Convert / Transcode」保持不动**:它在 `COMING_SOON` 里带「Coming soon」徽章(虚线框、opacity-60),已是诚实的 roadmap 标注,非 vaporware。

---

## 9. 决策状态

**已定(依据见 §0 决策表):** 包名 scoped `@fotovid/*` · 方法面命名空间式 · 参数 snake_case 直通 · v1 含 `probe` · `download()` 延后 v2 · License MIT。

**剩余待你拍板:**

- **首页文案时机**:删 transcode / endpoint→server,建议随上线(S7)一起改,发布前保持诚实。
- **建仓方式**:你手动建 `fotovid-js` 公开仓给我路径,还是授权我 `gh repo create`?(唯一挡开工的动作项)

> **`download()` 下载的是什么?** —— 每个操作返回的 `url` 是**成品文件**(加好水印的视频 / 抽出的音频 / 生成的缩略图…)的 presigned 下载地址,由 Fotovid 托管、有 TTL(~24h)。SDK 默认只把这个 `url` 交给你;要真正拿到字节,你得再 `fetch(res.url)` 一次并存盘。`download()` 就是把这第二步包成一行(拉回 `ArrayBuffer` 或直接写文件)。纯便利糖,v1 先不做(用户一行 fetch 即可),v2 再加。

---

## 10. 验证方案

- 每包:`build`(tsup)+ `typecheck`(tsc)+ `biome check`,CI 门禁。
- SDK:对真实 API 冒烟(一个测试 key + 一个公开样例媒体 URL),断言返回 `url` 可下载。
- MCP:`@modelcontextprotocol/inspector` 连本地 server,逐 tool 手测;并在 Claude Desktop 里实配一次跑通。
- 发布前:`npm publish --dry-run` + `pnpm changeset status` 核对将发内容与版本。
