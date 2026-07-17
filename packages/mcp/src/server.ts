import type { Fotovid } from "@fotovid/sdk";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

/** Run an SDK call and shape it into an MCP tool result. */
async function run(work: () => Promise<unknown>) {
	try {
		const data = await work();
		return {
			content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			content: [{ type: "text" as const, text: `Fotovid error: ${message}` }],
			isError: true,
		};
	}
}

// Shared input pieces (snake_case, 1:1 with the API).
const source_url = z
	.string()
	.url()
	.describe("Public http(s) URL of the source media");
const position = z
	.enum(["top-left", "top-right", "bottom-left", "bottom-right", "center"])
	.describe("Watermark anchor (default bottom-right)");
const output_format = z
	.enum(["webp", "jpeg", "jpg", "png"])
	.describe("Output image format (default webp)");
const quality = z
	.number()
	.int()
	.min(1)
	.max(100)
	.describe("Lossy quality 1–100 (png ignores it)");
const start = z.number().min(0).describe("Window start in seconds (inclusive)");
const end = z
	.number()
	.min(0)
	.describe("Window end in seconds (exclusive); must be greater than start");

const watermarkShape = {
	source_url,
	watermark_type: z
		.enum(["text", "image", "combo"])
		.optional()
		.describe("Watermark variant (default text)"),
	text: z
		.string()
		.optional()
		.describe("Overlay text (required for text/combo)"),
	font_size: z
		.number()
		.int()
		.min(8)
		.max(200)
		.optional()
		.describe("Text size in px (text/combo)"),
	font_color: z
		.string()
		.optional()
		.describe("Text color name or #RRGGBB (text/combo)"),
	watermark_image_url: z
		.string()
		.url()
		.optional()
		.describe("Logo image URL (required for image/combo)"),
	scale: z
		.number()
		.min(0)
		.max(1)
		.optional()
		.describe("Logo width as a fraction of source width (image/combo)"),
	opacity: z
		.number()
		.min(0)
		.max(1)
		.optional()
		.describe("Watermark opacity 0–1"),
	position: position.optional(),
	padding: z
		.number()
		.int()
		.min(0)
		.max(500)
		.optional()
		.describe("Edge padding in px"),
	output_format: output_format.optional(),
	quality: quality.optional(),
};

/** Build an MCP server exposing Fotovid media operations as tools. */
export function createServer(fotovid: Fotovid): McpServer {
	const server = new McpServer({ name: "fotovid", version: "0.1.0" });

	server.registerTool(
		"fotovid_watermark_video",
		{
			title: "Watermark a video",
			description:
				"Overlay text or a logo on a video (position, opacity, scale, padding). Returns a hosted, presigned URL to the finished video — it expires in ~24h, so store your own copy.",
			inputSchema: {
				...watermarkShape,
				preset: z
					.enum([
						"ultrafast",
						"superfast",
						"veryfast",
						"faster",
						"fast",
						"medium",
						"slow",
						"slower",
						"veryslow",
						"placebo",
					])
					.optional()
					.describe("x264 encode preset (video only)"),
			},
		},
		(args) => run(() => fotovid.video.watermark(args)),
	);

	server.registerTool(
		"fotovid_watermark_image",
		{
			title: "Watermark an image",
			description:
				"Overlay text or a logo on an image. Returns a hosted, presigned URL to the finished image — it expires in ~24h, so store your own copy.",
			inputSchema: watermarkShape,
		},
		(args) => run(() => fotovid.image.watermark(args)),
	);

	server.registerTool(
		"fotovid_trim_video",
		{
			title: "Trim a video",
			description:
				"Cut a frame-accurate clip between two timestamps (seconds). Returns a hosted, presigned URL to the trimmed video.",
			inputSchema: {
				source_url,
				start: start.optional(),
				end: end.optional(),
			},
		},
		(args) => run(() => fotovid.video.trim(args)),
	);

	server.registerTool(
		"fotovid_extract_audio",
		{
			title: "Extract audio from a video",
			description:
				"Pull the audio track out of a video and return it as an MP3 (hosted, presigned URL).",
			inputSchema: { source_url },
		},
		(args) => run(() => fotovid.video.extractAudio(args)),
	);

	server.registerTool(
		"fotovid_trim_audio",
		{
			title: "Trim an audio file",
			description:
				"Slice an audio file to a start/end window (seconds) and return it as an MP3 (hosted, presigned URL).",
			inputSchema: {
				source_url,
				start: start.optional(),
				end: end.optional(),
			},
		},
		(args) => run(() => fotovid.audio.trim(args)),
	);

	server.registerTool(
		"fotovid_video_thumbnail",
		{
			title: "Grab a video thumbnail",
			description:
				"Capture a frame at a given timestamp as an image thumbnail. Returns a hosted, presigned URL.",
			inputSchema: {
				source_url,
				at: z
					.number()
					.min(0)
					.optional()
					.describe("Frame timestamp in seconds (default ~1s)"),
				output_format: output_format.optional(),
				quality: quality.optional(),
			},
		},
		(args) => run(() => fotovid.video.thumbnail(args)),
	);

	server.registerTool(
		"fotovid_probe_video",
		{
			title: "Probe video metadata",
			description:
				"Return metadata for a video — width, height, duration, fps, codec, and alpha. Does not produce a file.",
			inputSchema: { source_url },
		},
		(args) => run(() => fotovid.video.probe(args)),
	);

	return server;
}
