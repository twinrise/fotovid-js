# @fotovid/sdk

[![npm](https://img.shields.io/npm/v/@fotovid/sdk)](https://www.npmjs.com/package/@fotovid/sdk)

Thin, typed Node.js / TypeScript SDK for the [Fotovid](https://fotovid.co) media API — a serverless ffmpeg API for watermarking video and images, trimming video and audio, extracting audio from video, generating video thumbnails, and probing video metadata. POST a source URL, await the finished file over one HTTPS call. No ffmpeg binary, no native dependencies, nothing to install beyond this package.

**Full docs, guides, and API reference:** [fotovid.co/docs](https://fotovid.co/docs)

## Why Fotovid

- **No ffmpeg to install or maintain.** No binary in your container/Lambda, no
  native build step, no version drift across machines — this package has zero
  runtime dependencies.
- **One call, typed end to end.** Parameters and results match the API 1:1;
  autocomplete works, nothing to guess.
- **Sync for quick jobs, async for large ones.** Small/short media returns in
  the same call; video over ~720p or 15s goes through the async task API
  instead of failing outright.
- **Idempotent by default.** Every billed call gets a fresh idempotency key
  automatically — retry safely without a double charge.
- **Hosted output.** Every operation returns a URL to the finished file; no
  storage bucket to provision or clean up yourself.

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

## License

MIT
