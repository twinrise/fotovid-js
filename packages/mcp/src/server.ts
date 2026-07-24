import type { Fotovid, Task } from "@fotovid/sdk";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Injected at build time from package.json by tsup (see tsup.config.ts).
declare const __MCP_VERSION__: string;

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

/**
 * Shape a just-submitted task into what an agent needs next: nothing has run
 * yet, so there's no `outputs`/`error` — just the id and where to check back.
 */
function submitted(task: Task) {
	return {
		task_id: task.id,
		status: task.status,
		poll_with: "fotovid_get_task" as const,
	};
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
		.max(1000)
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
		.regex(/^(#?[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?|[A-Za-z]+)$/)
		.optional()
		.describe("Text color: a name (letters only) or #RRGGBB[AA] (text/combo)"),
	watermark_image_url: z
		.string()
		.url()
		.optional()
		.describe("Logo image URL (required for image/combo)"),
	scale: z
		.number()
		.gt(0)
		.max(1)
		.optional()
		.describe("Logo width as a fraction of source width (>0–1; image/combo)"),
	opacity: z
		.number()
		.gt(0)
		.max(1)
		.optional()
		.describe("Watermark opacity (>0–1; omit for fully opaque)"),
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
	const server = new McpServer({ name: "fotovid", version: __MCP_VERSION__ });

	server.registerTool(
		"fotovid_watermark_video",
		{
			title: "Watermark a video",
			description:
				"Overlay text or a logo on a video (position, opacity, scale, padding). Returns a URL to the finished video — hosted, time-limited, opaque; see expires_at, and store your own copy.",
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
				"Overlay text or a logo on an image. Returns a URL to the finished image — hosted, time-limited, opaque; see expires_at, and store your own copy.",
			inputSchema: watermarkShape,
		},
		(args) => run(() => fotovid.image.watermark(args)),
	);

	server.registerTool(
		"fotovid_trim_video",
		{
			title: "Trim a video",
			description:
				"Cut a frame-accurate clip between two timestamps (seconds). Returns a URL to the trimmed video — hosted, time-limited, opaque; see expires_at.",
			inputSchema: {
				source_url,
				start,
				end,
			},
		},
		(args) => run(() => fotovid.video.trim(args)),
	);

	server.registerTool(
		"fotovid_extract_audio",
		{
			title: "Extract audio from a video",
			description:
				"Pull the audio track out of a video and return it as an MP3 — a hosted, time-limited, opaque URL; see expires_at.",
			inputSchema: { source_url },
		},
		(args) => run(() => fotovid.video.extractAudio(args)),
	);

	server.registerTool(
		"fotovid_trim_audio",
		{
			title: "Trim an audio file",
			description:
				"Slice an audio file to a start/end window (seconds) and return it as an MP3 — a hosted, time-limited, opaque URL; see expires_at.",
			inputSchema: {
				source_url,
				start,
				end,
			},
		},
		(args) => run(() => fotovid.audio.trim(args)),
	);

	server.registerTool(
		"fotovid_video_thumbnail",
		{
			title: "Grab a video thumbnail",
			description:
				"Capture a frame at a given timestamp as an image thumbnail. Returns a URL — hosted, time-limited, opaque; see expires_at.",
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

	// —— Async tools ——
	// The sync tools above reject inputs above ~720p / 15s with a 400 asking
	// for the async endpoint. These submit a task and return immediately —
	// they do NOT wait for it to finish. Follow up with fotovid_get_task
	// (status starting/processing → check again in a few seconds).

	server.registerTool(
		"fotovid_watermark_video_async",
		{
			title: "Watermark a video (async, for large/long video)",
			description:
				"Submit a video watermark job for input too large or long for the sync tool (over ~720p or 15s). Returns immediately with a task_id — poll fotovid_get_task for the result, do not wait here.",
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
		(args) => run(() => fotovid.tasks.video.watermark(args).then(submitted)),
	);

	server.registerTool(
		"fotovid_watermark_image_async",
		{
			title: "Watermark an image (async)",
			description:
				"Submit an image watermark job. Returns immediately with a task_id — poll fotovid_get_task for the result, do not wait here.",
			inputSchema: watermarkShape,
		},
		(args) => run(() => fotovid.tasks.image.watermark(args).then(submitted)),
	);

	server.registerTool(
		"fotovid_trim_video_async",
		{
			title: "Trim a video (async, for large/long video)",
			description:
				"Submit a video trim job for input too large or long for the sync tool. Returns immediately with a task_id — poll fotovid_get_task for the result, do not wait here.",
			inputSchema: { source_url, start, end },
		},
		(args) => run(() => fotovid.tasks.video.trim(args).then(submitted)),
	);

	server.registerTool(
		"fotovid_extract_audio_async",
		{
			title: "Extract audio from a video (async, for large/long video)",
			description:
				"Submit an audio-extraction job for input too large or long for the sync tool. Returns immediately with a task_id — poll fotovid_get_task for the result, do not wait here.",
			inputSchema: { source_url },
		},
		(args) => run(() => fotovid.tasks.video.extractAudio(args).then(submitted)),
	);

	server.registerTool(
		"fotovid_trim_audio_async",
		{
			title: "Trim an audio file (async, for large/long audio)",
			description:
				"Submit an audio trim job for input too large or long for the sync tool. Returns immediately with a task_id — poll fotovid_get_task for the result, do not wait here.",
			inputSchema: { source_url, start, end },
		},
		(args) => run(() => fotovid.tasks.audio.trim(args).then(submitted)),
	);

	server.registerTool(
		"fotovid_video_thumbnail_async",
		{
			title: "Grab a video thumbnail (async, for large/long video)",
			description:
				"Submit a video-thumbnail job for input too large or long for the sync tool. Returns immediately with a task_id — poll fotovid_get_task for the result, do not wait here.",
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
		(args) => run(() => fotovid.tasks.video.thumbnail(args).then(submitted)),
	);

	server.registerTool(
		"fotovid_get_task",
		{
			title: "Check an async task",
			description:
				"Check the status of a task submitted by one of the _async tools. While status is starting/processing, outputs/error are absent — wait a couple of seconds and call again. Once status is succeeded, outputs has the result(s); once failed, error explains why (this is normal — not an exception).",
			inputSchema: {
				task_id: z.string().describe("Task id returned by an _async tool"),
			},
		},
		({ task_id }) =>
			run(async () => {
				const task = await fotovid.tasks.get(task_id);
				return {
					task_id: task.id,
					status: task.status,
					outputs: task.outputs,
					error: task.error,
				};
			}),
	);

	return server;
}
