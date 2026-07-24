# fotovid-js

Official JavaScript / TypeScript packages for the [Fotovid](https://fotovid.co) media API — run ffmpeg-style media operations (watermark, trim, extract audio, thumbnails…) over one HTTPS call, with no ffmpeg binary in your bundle.

| Package | Description |
| --- | --- |
| [`@fotovid/sdk`](./packages/sdk) | Thin, typed client for Node & TypeScript |
| [`@fotovid/mcp`](./packages/mcp) | MCP server exposing Fotovid as first-class agent tools |

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
