# @fotovid/mcp

An [MCP](https://modelcontextprotocol.io) server that exposes the [Fotovid](https://fotovid.co) media API as first-class tools, so your agents and AI tools can watermark, trim, extract audio, and generate thumbnails with a single tool call.

> **Status: pre-release scaffold.** Tool wiring is not yet implemented.

## Usage (planned)

Run locally via `npx` and point your MCP client at it:

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

## License

MIT
