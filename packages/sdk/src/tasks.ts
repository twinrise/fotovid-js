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
	/**
	 * The input exactly as submitted: `source_url` plus this task type's
	 * processing params, flattened into one object. Also delivered to your
	 * webhook and retained in the delivery record.
	 */
	input?: Record<string, unknown>;
	/**
	 * The labels you passed as `metadata`, returned verbatim. Omitted when none
	 * were supplied; on an idempotent replay this is the *stored* task's
	 * metadata, not what the replay sent.
	 */
	metadata?: Record<string, string>;
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

/** The minimum every task input carries: the media to process. */
export interface TaskInput {
	source_url: string;
}

/**
 * `I` is the task type's own input shape (e.g. `VideoWatermarkInput`), so the
 * typed helpers keep their precise parameter types instead of widening to
 * `Record<string, unknown>`.
 */
export interface CreateTaskInput<I extends TaskInput = TaskInput> {
	type: TaskType;
	/**
	 * The source media URL plus this task type's processing params, in one flat
	 * object — the same shape the sync helpers take.
	 *
	 * BREAKING (1.0.0): this replaces the old `{ source_url, params }` pair. The
	 * flat helpers below (`tasks.video.*`, `tasks.image.*`, `tasks.audio.*`)
	 * already took this shape and are unchanged.
	 */
	input: I;
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
	/**
	 * Your own key/value labels, echoed back on the `Task` and in the webhook
	 * payload. Never interpreted by the platform — no routing, auth, billing or
	 * idempotency. At most 50 keys; keys ≤40 chars (no square brackets); values
	 * are strings, ≤500 chars. Don't put secrets here.
	 */
	metadata?: Record<string, string>;
	signal?: AbortSignal;
}

function taskBody(
	input: CreateTaskInput<TaskInput>,
	options: TaskRequestOptions | undefined,
) {
	return {
		type: input.type,
		input: input.input,
		idempotency_key: options?.idempotencyKey ?? globalThis.crypto.randomUUID(),
		webhook: options?.webhook,
		webhook_events_filter: options?.webhookEventsFilter,
		metadata: options?.metadata,
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

	create<I extends TaskInput>(
		input: CreateTaskInput<I>,
		options?: TaskRequestOptions,
	): Promise<Task> {
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
			this.create({ type: "video.watermark", input }, options),
		trim: (input: TrimInput, options?: TaskRequestOptions) =>
			this.create({ type: "video.trim", input }, options),
		extractAudio: (input: ExtractAudioInput, options?: TaskRequestOptions) =>
			this.create({ type: "video.audio", input }, options),
		thumbnail: (input: ThumbnailInput, options?: TaskRequestOptions) =>
			this.create({ type: "video.cover", input }, options),
	};

	readonly image = {
		watermark: (input: ImageWatermarkInput, options?: TaskRequestOptions) =>
			this.create({ type: "image.watermark", input }, options),
	};

	readonly audio = {
		trim: (input: TrimAudioInput, options?: TaskRequestOptions) =>
			this.create({ type: "audio.trim", input }, options),
	};
}
