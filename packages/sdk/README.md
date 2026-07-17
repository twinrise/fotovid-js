# @fotovid/sdk

Thin, typed TypeScript/Node client for the [Fotovid](https://fotovid.co) media API. POST a URL, await the finished file — no ffmpeg binary in your bundle.

> **Status: pre-release.** Not yet published to npm.

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

console.log(res.url); // presigned URL to the finished file — store your own copy
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

## Config

```ts
new Fotovid({
	apiKey: "p6_<key_id>:<secret>", // or set FOTOVID_API_KEY
	baseUrl: "https://api.fotovid.co", // optional
	fetch: customFetch, // optional, defaults to global fetch (Node 18+)
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

## License

MIT
