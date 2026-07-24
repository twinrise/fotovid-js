import { FotovidError } from "./error.js";

// Injected at build time from package.json by tsup (see tsup.config.ts).
declare const __SDK_VERSION__: string;

export interface RequestContext {
	apiKey: string;
	baseUrl: string;
	fetch: typeof globalThis.fetch;
}

export interface JsonRequestInit {
	method: "GET" | "POST";
	body?: unknown;
	headers?: Record<string, string>;
	signal?: AbortSignal;
}

/**
 * Shared low-level request used by both the sync (client.ts) and the async
 * (tasks.ts) surfaces — same auth, UA, and error handling either way.
 */
export async function requestJson<T>(
	ctx: RequestContext,
	path: string,
	init: JsonRequestInit,
): Promise<T> {
	const response = await ctx.fetch(new URL(path, ctx.baseUrl), {
		method: init.method,
		headers: {
			authorization: `Bearer ${ctx.apiKey}`,
			// An explicit UA identifies the SDK to the edge and to server-side
			// observability. (The Python SDK's default urllib UA was blocked by
			// Cloudflare with a 403 — Node's fetch UA is not, but be explicit.)
			"user-agent": `fotovid-sdk/${__SDK_VERSION__}`,
			...(init.body !== undefined
				? { "content-type": "application/json" }
				: {}),
			...init.headers,
		},
		body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
		signal: init.signal,
	});
	if (!response.ok) {
		let detail: unknown;
		try {
			detail = await response.json();
		} catch {
			// non-JSON error body — leave detail undefined
		}
		const ra = response.headers.get("retry-after");
		const retryAfter = ra ? Number(ra) : undefined;
		throw new FotovidError(response.status, detail, retryAfter);
	}
	return (await response.json()) as T;
}
