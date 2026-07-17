/** Anchor position for a watermark overlay. */
export type WatermarkPosition =
	| "top-left"
	| "top-right"
	| "bottom-left"
	| "bottom-right"
	| "center";

/** Output image format for image-producing operations. */
export type ImageFormat = "webp" | "jpeg" | "jpg" | "png";

/** Watermark variant. */
export type WatermarkType = "text" | "image" | "combo";

/** x264 encode preset (video watermark only). */
export type X264Preset =
	| "ultrafast"
	| "superfast"
	| "veryfast"
	| "faster"
	| "fast"
	| "medium"
	| "slow"
	| "slower"
	| "veryslow"
	| "placebo";

/** Every request carries the source media URL. */
interface SourceInput {
	/** Public http(s) URL of the source media. */
	source_url: string;
}

export interface VideoWatermarkInput extends SourceInput {
	watermark_type?: WatermarkType;
	/** Overlay text (required for text/combo). */
	text?: string;
	/** Text size in px, 8–200 (text/combo). */
	font_size?: number;
	/** Text color name or #RRGGBB (text/combo). */
	font_color?: string;
	/** Logo image URL (required for image/combo). */
	watermark_image_url?: string;
	/** Logo width as a fraction of source width, 0–1 (image/combo). */
	scale?: number;
	/** Watermark opacity, 0–1. */
	opacity?: number;
	position?: WatermarkPosition;
	/** Edge padding in px, 0–500. */
	padding?: number;
	output_format?: ImageFormat;
	/** Lossy quality 1–100 (png ignores it). */
	quality?: number;
	/** x264 encode preset — video only. */
	preset?: X264Preset;
}

export type ImageWatermarkInput = Omit<VideoWatermarkInput, "preset">;

export interface TrimInput extends SourceInput {
	/** Window start in seconds (inclusive). */
	start?: number;
	/** Window end in seconds (exclusive); must be greater than start. */
	end?: number;
}

export type ExtractAudioInput = SourceInput;

export interface CropAudioInput extends SourceInput {
	/** Window start in seconds (inclusive). */
	start?: number;
	/** Window end in seconds (exclusive); must be greater than start. */
	end?: number;
}

export interface ThumbnailInput extends SourceInput {
	/** Frame timestamp in seconds (default ~1s). */
	at?: number;
	output_format?: ImageFormat;
	/** Lossy quality 1–100 (png ignores it). */
	quality?: number;
}

export type ProbeInput = SourceInput;

/** Result of a media-producing operation. */
export interface MediaResult {
	/** Result record id (echoed on idempotent replay). */
	id: string;
	/** Task type that produced this result. */
	type: string;
	/** Presigned download URL — expires; store your own copy. */
	url: string;
	/** RFC 3339 time the presigned URL expires. */
	expires_at: string;
	/** Result media duration in seconds, when known. */
	duration?: number;
}

/** Result of a probe — metadata only, no artifact. */
export interface ProbeResult {
	id: string;
	type: string;
	width: number;
	height: number;
	durationSec: number;
	/** Frame rate as ffprobe reports r_frame_rate (e.g. "30/1"). */
	fps: string;
	/** First video stream codec (e.g. "h264"). */
	codec: string;
	hasAlpha: boolean;
}

export interface FotovidOptions {
	/** API key `p6_<key_id>:<secret>`. Falls back to `FOTOVID_API_KEY`. */
	apiKey?: string;
	/** API base URL. Defaults to https://api.fotovid.co */
	baseUrl?: string;
	/** Custom fetch implementation (defaults to the global fetch). */
	fetch?: typeof globalThis.fetch;
}
