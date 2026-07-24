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
- **The same operations, as agent tools.** `@fotovid/mcp` exposes every
  operation to Claude, Cursor, and other MCP clients — no custom tool code to
  write.
- **Idempotent by default, hosted output.** Every billed call gets a fresh
  idempotency key automatically; every operation returns a URL to the
  finished file — no storage bucket to provision yourself.

## Quickstart

```bash
npm install @fotovid/sdk
```

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

console.log(res.url); // finished video, ready to download
```

See each package's README for the full API, async usage (large/long video),
and error handling.

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
