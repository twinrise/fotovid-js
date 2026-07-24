# @fotovid/mcp

[![npm](https://img.shields.io/npm/v/@fotovid/mcp)](https://www.npmjs.com/package/@fotovid/mcp)

An [MCP](https://modelcontextprotocol.io) server (Model Context Protocol) that exposes the [Fotovid](https://fotovid.co) serverless ffmpeg API as first-class AI agent tools — watermark video and images, trim video and audio, extract audio from video, generate video thumbnails, and probe video metadata, all with a single tool call and no ffmpeg binary anywhere.

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

### Async tools (large or long video)

The tools above reject video over ~720p or 15s (a hard sync-API limit). For
larger input, use the matching `_async` tool — it submits a task and returns
immediately with a `task_id`, then poll `fotovid_get_task` until it's done:

| Tool | Operation |
| --- | --- |
| `fotovid_watermark_video_async` | Submit a video watermark task |
| `fotovid_watermark_image_async` | Submit an image watermark task |
| `fotovid_trim_video_async` | Submit a video trim task |
| `fotovid_extract_audio_async` | Submit an audio-extraction task |
| `fotovid_trim_audio_async` | Submit an audio trim task |
| `fotovid_video_thumbnail_async` | Submit a video-thumbnail task |
| `fotovid_get_task` | Check a task's status — `outputs` once succeeded, `error` once failed |

There's no async form of `fotovid_probe_video` — probing is sync-only.

## License

MIT
