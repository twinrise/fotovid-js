import { Fotovid } from "@fotovid/sdk";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";

async function main() {
	const apiKey = process.env.FOTOVID_API_KEY;
	if (!apiKey) {
		console.error(
			"@fotovid/mcp: missing FOTOVID_API_KEY environment variable.",
		);
		process.exit(1);
	}

	const fotovid = new Fotovid({
		apiKey,
		baseUrl: process.env.FOTOVID_BASE_URL,
	});

	const server = createServer(fotovid);
	const transport = new StdioServerTransport();
	await server.connect(transport);

	// stdout is reserved for the MCP protocol; logs go to stderr.
	console.error("@fotovid/mcp: server running on stdio");
}

main().catch((error) => {
	console.error("@fotovid/mcp: fatal error", error);
	process.exit(1);
});
