# fotovid-js

Official JavaScript / TypeScript packages for the [Fotovid](https://fotovid.co) media API — a serverless ffmpeg API for video and image processing. Watermark video and images, trim video and audio, extract audio from video, generate video thumbnails, and probe video metadata, all over one HTTPS call, with no ffmpeg binary in your bundle. Large or long video that doesn't fit the sync time budget goes through an async task API instead.

| Package | Description |
| --- | --- |
| [`@fotovid/sdk`](./packages/sdk) | Thin, typed Node.js / TypeScript SDK, sync + async |
| [`@fotovid/mcp`](./packages/mcp) | MCP server exposing Fotovid as first-class AI agent tools |

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
