import { type RequestContext, requestJson } from "./http.js";
import type {
	ExtractAudioInput,
	ImageWatermarkInput,
	ThumbnailInput,
	TrimAudioInput,
	TrimInput,
	VideoWatermarkInput,
} from "./types.js";

/**
 * Async task type. Deliberately excludes `"video.meta"` — the async worker
 * always fails it (probe has no artifact to produce); use the sync
 * `client.video.probe` instead.
 */
export type TaskType =
	| "image.watermark"
	| "video.watermark"
	| "video.cover"
	| "video.trim"
	| "video.audio"
	| "audio.trim";

export type TaskStatus =
	| "starting"
	| "processing"
	| "succeeded"
	| "failed"
	| "canceled";

export type WebhookEvent = "completed" | "failed";

/** Stable, closed set of task-level error codes (`taskerr.ExternalCode`). */
export type TaskErrorCode =
	| "invalid_input"
	| "unsupported_media"
	| "source_unreachable"
	| "source_too_large"
	| "unknown_task_type"
	| "insufficient_credits"
	| "processing_failed"
	| "internal_error";

/** One produced artifact. `kind` is `"video" | "cover" | "image" | "audio"`. */
export interface TaskOutput {
	kind: string;
	url: string;
}

/**
 * Task-level failure, carried in `Task.error` on a `"failed"` task. Distinct
 * from `FotovidError`, which is thrown for transport-layer failures (a
 * non-2xx response to create/get itself).
 */
export interface TaskError {
	code: TaskErrorCode;
	message: string;
	request_id: string;
	detail?: string;
}

export interface Task {
	id: string;
	status: TaskStatus;
	task_type?: string;
	/** Produced artifacts, once `status` is `"succeeded"`. Order is not guaranteed — read by `kind`. */
	outputs?: TaskOutput[];
	/** Present when `status` is `"failed"`. A failed task is not an exception — check this field. */
	error: TaskError | null;
	source: string;
	data_removed: boolean;
	created_at: string;
	started_at?: string;
	completed_at?: string;
	/** RFC 3339, empty until the task succeeds. Output artifacts expire 7 days after completion. */
	expires_at?: string;
	metrics?: { total_time?: number };
	/** `get`: this task's own polling URL — not a download link. */
	urls: { get: string };
}

export interface CreateTaskInput {
	type: TaskType;
	source_url: string;
	params?: Record<string, unknown>;
}

export interface TaskRequestOptions {
	/**
	 * Idempotency key (≤64 chars). Defaults to a fresh UUID per call, like the
	 * sync surface — unlike sync, this is a JSON body field, not a header.
	 */
	idempotencyKey?: string;
	/** URL notified (HMAC-signed) when the task reaches a terminal state. */
	webhook?: string;
	/** Restrict which terminal states trigger the webhook. Default: all. */
	webhookEventsFilter?: WebhookEvent[];
	signal?: AbortSignal;
}

function taskBody(
	input: CreateTaskInput,
	options: TaskRequestOptions | undefined,
) {
	return {
		type: input.type,
		source_url: input.source_url,
		params: input.params,
		idempotency_key: options?.idempotencyKey ?? globalThis.crypto.randomUUID(),
		webhook: options?.webhook,
		webhook_events_filter: options?.webhookEventsFilter,
	};
}

/**
 * Async task surface: submit larger jobs than the sync endpoints accept, then
 * poll for the result. There is no built-in `wait` — poll `get` yourself:
 *
 * ```ts
 * let task = await client.tasks.video.watermark({ source_url, ...params });
 * while (task.status === "starting" || task.status === "processing") {
 *   await new Promise((r) => setTimeout(r, 2000));
 *   task = await client.tasks.get(task.id);
 * }
 * ```
 */
export class Tasks {
	readonly #ctx: RequestContext;

	constructor(ctx: RequestContext) {
		this.#ctx = ctx;
	}

	create(input: CreateTaskInput, options?: TaskRequestOptions): Promise<Task> {
		return requestJson<Task>(this.#ctx, "/v1/tasks", {
			method: "POST",
			body: taskBody(input, options),
		});
	}

	/** `failed` is not thrown — check `task.error`. Only a transport failure throws `FotovidError`. */
	get(id: string, options?: { signal?: AbortSignal }): Promise<Task> {
		return requestJson<Task>(this.#ctx, `/v1/tasks/${encodeURIComponent(id)}`, {
			method: "GET",
			signal: options?.signal,
		});
	}

	readonly video = {
		watermark: (input: VideoWatermarkInput, options?: TaskRequestOptions) =>
			this.create({ type: "video.watermark", ...splitInput(input) }, options),
		trim: (input: TrimInput, options?: TaskRequestOptions) =>
			this.create({ type: "video.trim", ...splitInput(input) }, options),
		extractAudio: (input: ExtractAudioInput, options?: TaskRequestOptions) =>
			this.create({ type: "video.audio", ...splitInput(input) }, options),
		thumbnail: (input: ThumbnailInput, options?: TaskRequestOptions) =>
			this.create({ type: "video.cover", ...splitInput(input) }, options),
	};

	readonly image = {
		watermark: (input: ImageWatermarkInput, options?: TaskRequestOptions) =>
			this.create({ type: "image.watermark", ...splitInput(input) }, options),
	};

	readonly audio = {
		trim: (input: TrimAudioInput, options?: TaskRequestOptions) =>
			this.create({ type: "audio.trim", ...splitInput(input) }, options),
	};
}

/** Splits a sync-style `{ source_url, ...params }` input into the task envelope shape. */
function splitInput(input: { source_url: string }): {
	source_url: string;
	params: Record<string, unknown>;
} {
	const { source_url, ...params } = input;
	return { source_url, params };
}
