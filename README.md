# fotovid-js

[![npm sdk](https://img.shields.io/npm/v/@fotovid/sdk?label=%40fotovid%2Fsdk)](https://www.npmjs.com/package/@fotovid/sdk)
[![npm mcp](https://img.shields.io/npm/v/@fotovid/mcp?label=%40fotovid%2Fmcp)](https://www.npmjs.com/package/@fotovid/mcp)
[![license](https://img.shields.io/npm/l/@fotovid/sdk)](./LICENSE)

Official JavaScript / TypeScript packages for the [Fotovid](https://fotovid.co) media API — a serverless ffmpeg API for video and image processing. Watermark video and images, trim video and audio, extract audio from video, generate video thumbnails, and probe video metadata, all over one HTTPS call, with no ffmpeg binary and no native dependencies to install. Large or long video that doesn't fit the sync time budget goes through an async task API instead. Also ships an MCP (Model Context Protocol) server so AI agents get the same operations as first-class tools.

**Full docs, guides, and API reference:** [fotovid.co/docs](https://fotovid.co/docs)

## Why Fotovid

- **No ffmpeg to install or maintain.** No binary in your container/Lambda, no
  native build step — `@fotovid/sdk` has zero runtime dependencies.
- **Sync for quick jobs, async for large ones.** Small/short media returns in
  the same call; video over ~720p or 15s goes through the async task API
  instead of failing outright.
- **Idempotent by default.** Every billed call gets a fresh idempotency key
  automatically — retry safely without a double charge.
- **Hosted output.** Every operation returns a URL to the finished file; no
  storage bucket to provision or clean up yourself.
- **The same operations, as agent tools.** `@fotovid/mcp` exposes every
  operation to Claude, Cursor, and other MCP clients — no custom tool code to
  write.

## Install

```bash
npm install @fotovid/sdk
```

## Usage

```ts
import Fotovid from "@fotovid/sdk";

const fotovid = new Fotovid({ apiKey: process.env.FOTOVID_API_KEY });

const res = await fotovid.video.watermark({
	source_url: "https://cdn.example.com/clip.mp4",
	watermark_type: "image",
	watermark_image_url: "https://cdn.example.com/logo.png",
	position: "bottom-right",
	opacity: 0.8,
});

console.log(res.url); // URL to the finished file — hosted, time-limited, opaque; see expires_at, store your own copy
```

## Operations

| Method | Endpoint |
| --- | --- |
| `fotovid.video.watermark(input)` | `POST /v1/video/watermark` |
| `fotovid.image.watermark(input)` | `POST /v1/image/watermark` |
| `fotovid.video.trim(input)` | `POST /v1/video/trim` |
| `fotovid.video.extractAudio(input)` | `POST /v1/video/extract-audio` |
| `fotovid.audio.trim(input)` | `POST /v1/audio/trim` |
| `fotovid.video.thumbnail(input)` | `POST /v1/video/extract-cover` |
| `fotovid.video.probe(input)` | `POST /v1/video/probe` |

Parameter names match the API 1:1 (`source_url`, `watermark_image_url`, …). Every
media operation returns `{ id, type, url, expires_at, duration? }`; `probe`
returns video metadata.

## Examples

### Video

```ts
// Text watermark, bottom-right corner.
await fotovid.video.watermark({
	source_url: "https://cdn.example.com/clip.mp4",
	watermark_type: "text",
	text: "© Acme Inc.",
	position: "bottom-right",
});

// Cut a 10s clip.
await fotovid.video.trim({
	source_url: "https://cdn.example.com/clip.mp4",
	start: 5,
	end: 15,
});

// Pull out the audio track as an MP3.
await fotovid.video.extractAudio({
	source_url: "https://cdn.example.com/clip.mp4",
});

// Grab a frame at 2.5s as a thumbnail.
await fotovid.video.thumbnail({
	source_url: "https://cdn.example.com/clip.mp4",
	at: 2.5,
});

// Metadata only — no file produced.
const meta = await fotovid.video.probe({
	source_url: "https://cdn.example.com/clip.mp4",
});
console.log(meta.width, meta.height, meta.durationSec, meta.fps, meta.codec);
```

### Image

```ts
// Logo watermark, scaled to 20% of the source width.
await fotovid.image.watermark({
	source_url: "https://cdn.example.com/photo.jpg",
	watermark_type: "image",
	watermark_image_url: "https://cdn.example.com/logo.png",
	scale: 0.2,
});
```

### Audio

```ts
await fotovid.audio.trim({
	source_url: "https://cdn.example.com/track.mp3",
	start: 0,
	end: 30,
});
```

## Async (large or long video)

The sync methods above reject video over ~720p or 15s with a 400 asking you to
use the async endpoint (a hard limit — the sync API has a short time budget).
For a large video watermark, a long trim, or anything you don't need back in a
couple of seconds, submit a task instead and poll for the result:

```ts
let task = await fotovid.tasks.video.watermark({
	source_url: "https://cdn.example.com/1080x1920.mp4", // vertical / large video, rejected by sync
	watermark_type: "image",
	watermark_image_url: "https://cdn.example.com/logo.png",
});

while (task.status === "starting" || task.status === "processing") {
	await new Promise((r) => setTimeout(r, 2000));
	task = await fotovid.tasks.get(task.id);
}

if (task.status === "succeeded") {
	console.log(task.outputs); // [{ kind: "video", url: "..." }, ...] — read by kind, order not guaranteed
} else {
	console.error(task.error); // { code, message, request_id, detail? } — a failed task, not an exception
}
```

`tasks.*` mirrors the sync methods 1:1 (`tasks.video.watermark`, `tasks.video.trim`,
`tasks.video.extractAudio`, `tasks.video.thumbnail`, `tasks.image.watermark`,
`tasks.audio.trim`) plus the low-level `tasks.create`/`tasks.get`. There's no
built-in polling helper — the loop above is the whole pattern. `probe` has no
async form; it's sync-only.

### Your own metadata

Pass `metadata` in the options argument to tag a task with your own labels. They
come back on the `Task` and in the webhook payload, so a callback can be matched
against your records without a second lookup:

```ts
const task = await fotovid.tasks.video.trim(
	{ source_url: "https://cdn.example.com/clip.mp4", start: 0, end: 30 },
	{
		metadata: { order_id: "A-1001", tenant: "acme" },
		webhook: "https://example.com/hooks/fotovid",
	},
);

task.metadata; // { order_id: "A-1001", tenant: "acme" }
```

The platform never interprets `metadata` — it takes no part in routing, auth,
billing or idempotency. At most 50 keys, keys ≤40 chars (no square brackets),
string values ≤500 chars. Don't put secrets in it: it is returned to anyone who
can read the task and delivered to your webhook endpoint. On an idempotent replay
the stored task's metadata comes back and the one you sent is ignored.

`Task` also echoes `input` back exactly as submitted — the `source_url` plus that task type's params, flattened into one object.

### Breaking in 1.0.0: the `input` envelope

The async wire moved to an `input` envelope. **The typed helpers above are
unchanged** — `tasks.video.watermark({ source_url, ...params })` still takes one
flat object. Only two things moved:

```ts
// tasks.create — the low-level escape hatch
await fotovid.tasks.create({ type: "video.trim", source_url, params: { start, end } }); // ❌ 0.x
await fotovid.tasks.create({ type: "video.trim", input: { source_url, start, end } });  // ✅ 1.0

// Task — the two echo fields collapsed into one
task.source_url; task.params; // ❌ 0.x
task.input;                   // ✅ 1.0
```

The server rejects the old request shape with `400` and an
`errors[].field` of `body.input.source_url`. The response change is silent —
`task.source_url` and `task.params` simply become `undefined` — so grep for them
when you upgrade. Sync endpoints (`fotovid.video.*`, `fotovid.image.*`,
`fotovid.audio.*`) are untouched.

## Sync vs async

| | Sync (`fotovid.video.*`, …) | Async (`fotovid.tasks.*`) |
| --- | --- | --- |
| Returns | Finished result, same call | A `Task` — poll `tasks.get` until terminal |
| Limits | ~720p / 15s | 4K / 600s |
| Use for | Small/short media, need the result now | Large video, long clips, batch/background jobs |

## Config

```ts
new Fotovid({
	apiKey: "p6_<key_id>:<secret>", // or set FOTOVID_API_KEY
	baseUrl: "https://api.fotovid.co", // optional
	fetch: customFetch, // optional, defaults to global fetch (Node 20+)
});
```

## Idempotency

Every operation is billed, so the API requires an `Idempotency-Key` header. The
SDK sends a fresh key per call automatically — you don't have to do anything. To
safely retry a request without being charged twice, pass the same key both times:

```ts
const idempotencyKey = crypto.randomUUID();
const opts = { idempotencyKey };

await fotovid.video.watermark(input, opts);
// A retry with the same key replays the original result instead of re-charging.
await fotovid.video.watermark(input, opts);
```

The same applies to `fotovid.tasks.*` — pass `idempotencyKey` there too (it travels
in the request body, not a header, but the SDK handles that difference for you).

## Errors

A non-2xx response throws `FotovidError` (`status`, `detail`, `retryAfter`).
For `fotovid.tasks.*`, that's the only thing that throws — a task that finishes
as `"failed"` is a normal return value, not an exception; check `task.error`.

## Documentation

- [Getting started](https://fotovid.co/docs/getting-started/quickstart)
- [API reference](https://fotovid.co/docs/reference/http) — every endpoint, with request/response schemas
- [Sync vs async guide](https://fotovid.co/docs/guides/sync-vs-async)
- [Pricing](https://fotovid.co/pricing)

## Packages

| Package | Description |
| --- | --- |
| [`@fotovid/sdk`](./packages/sdk) | Thin, typed Node.js / TypeScript SDK for video watermarking, trimming, audio extraction, thumbnails, and probing — sync + async |
| [`@fotovid/mcp`](./packages/mcp) | MCP server exposing the same operations as first-class tools for AI agents (Claude, Cursor, and other MCP clients) |

## Development

```bash
pnpm install
pnpm build       # build all packages
pnpm typecheck
pnpm lint
```

Releases are managed with [changesets](https://github.com/changesets/changesets):

```bash
pnpm changeset   # describe your change
```

## License

MIT © Fotovid
