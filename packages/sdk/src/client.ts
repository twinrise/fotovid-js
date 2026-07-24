import { requestJson } from "./http.js";
import { Tasks } from "./tasks.js";
import type {
	ExtractAudioInput,
	FotovidOptions,
	ImageWatermarkInput,
	MediaResult,
	ProbeInput,
	ProbeResult,
	RequestOptions,
	ThumbnailInput,
	TrimAudioInput,
	TrimInput,
	VideoWatermarkInput,
} from "./types.js";

const DEFAULT_BASE_URL = "https://api.fotovid.co";

function resolveApiKey(explicit: string | undefined): string {
	const key =
		explicit ??
		(typeof process !== "undefined" ? process.env?.FOTOVID_API_KEY : undefined);
	if (!key) {
		throw new Error(
			"Fotovid: missing API key. Pass { apiKey } or set FOTOVID_API_KEY.",
		);
	}
	return key;
}

/**
 * Typed client for the Fotovid media API. Methods mirror the REST resources
 * (`client.video.*`, `client.image.*`, `client.audio.*`); parameter names
 * match the API 1:1 (`source_url`, `watermark_image_url`, …).
 */
export class Fotovid {
	readonly #apiKey: string;
	readonly #baseUrl: string;
	readonly #fetch: typeof globalThis.fetch;

	/** Async task surface — submit larger jobs than sync accepts, then poll for the result. */
	readonly tasks: Tasks;

	constructor(options: FotovidOptions = {}) {
		this.#apiKey = resolveApiKey(options.apiKey);
		this.#baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
		this.#fetch = options.fetch ?? globalThis.fetch;
		this.tasks = new Tasks({
			apiKey: this.#apiKey,
			baseUrl: this.#baseUrl,
			fetch: this.#fetch,
		});
	}

	#post<T>(
		path: string,
		input: { source_url: string },
		options?: RequestOptions,
	): Promise<T> {
		const { source_url, ...params } = input;
		return requestJson<T>(
			{ apiKey: this.#apiKey, baseUrl: this.#baseUrl, fetch: this.#fetch },
			path,
			{
				method: "POST",
				body: { source_url, params },
				headers: {
					// Billed endpoints require an idempotency key; default to a fresh
					// UUID per call, overridable to make a retry replay (not re-charge).
					"idempotency-key":
						options?.idempotencyKey ?? globalThis.crypto.randomUUID(),
				},
			},
		);
	}

	readonly video = {
		watermark: (
			input: VideoWatermarkInput,
			options?: RequestOptions,
		): Promise<MediaResult> =>
			this.#post<MediaResult>("/v1/video/watermark", input, options),
		trim: (input: TrimInput, options?: RequestOptions): Promise<MediaResult> =>
			this.#post<MediaResult>("/v1/video/trim", input, options),
		extractAudio: (
			input: ExtractAudioInput,
			options?: RequestOptions,
		): Promise<MediaResult> =>
			this.#post<MediaResult>("/v1/video/extract-audio", input, options),
		thumbnail: (
			input: ThumbnailInput,
			options?: RequestOptions,
		): Promise<MediaResult> =>
			this.#post<MediaResult>("/v1/video/extract-cover", input, options),
		probe: (
			input: ProbeInput,
			options?: RequestOptions,
		): Promise<ProbeResult> =>
			this.#post<ProbeResult>("/v1/video/probe", input, options),
	};

	readonly image = {
		watermark: (
			input: ImageWatermarkInput,
			options?: RequestOptions,
		): Promise<MediaResult> =>
			this.#post<MediaResult>("/v1/image/watermark", input, options),
	};

	readonly audio = {
		trim: (
			input: TrimAudioInput,
			options?: RequestOptions,
		): Promise<MediaResult> =>
			this.#post<MediaResult>("/v1/audio/trim", input, options),
	};
}
