# @fotovid/mcp

An [MCP](https://modelcontextprotocol.io) server that exposes the [Fotovid](https://fotovid.co) media API as first-class tools, so your agents and AI tools can watermark, trim, extract audio, and generate thumbnails with a single tool call.

> **Status: pre-release.** Not yet published to npm.

## Usage

Run locally over stdio and point your MCP client at it. Your Fotovid API key is
read from the `FOTOVID_API_KEY` environment variable.

```jsonc
// Claude Desktop / Cursor mcp config
{
	"mcpServers": {
		"fotovid": {
			"command": "npx",
			"args": ["-y", "@fotovid/mcp"],
			"env": { "FOTOVID_API_KEY": "p6_<key_id>:<secret>" }
		}
	}
}
```

## Tools

| Tool | Operation |
| --- | --- |
| `fotovid_watermark_video` | Overlay text/logo on a video |
| `fotovid_watermark_image` | Overlay text/logo on an image |
| `fotovid_trim_video` | Cut a clip between two timestamps |
| `fotovid_extract_audio` | Extract a video's audio as MP3 |
| `fotovid_trim_audio` | Slice an audio file to a window |
| `fotovid_video_thumbnail` | Capture a frame as a thumbnail |
| `fotovid_probe_video` | Return video metadata (no file) |

Each media tool returns a URL to the finished file — hosted, time-limited,
opaque; see `expires_at` and store your own copy. Built on
[`@fotovid/sdk`](../sdk).

## License

MIT
