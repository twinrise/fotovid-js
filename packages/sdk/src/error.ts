function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

/** Thrown when the Fotovid API returns a non-2xx response. */
export class FotovidError extends Error {
	/** HTTP status code of the failed response. */
	readonly status: number;
	/** Parsed error body, when the response carried one. */
	readonly detail: unknown;

	constructor(status: number, detail: unknown) {
		let message: string | undefined;
		if (isRecord(detail)) {
			if (typeof detail.detail === "string") {
				message = detail.detail;
			} else if (typeof detail.message === "string") {
				message = detail.message;
			}
		}
		super(message ?? `Fotovid API request failed with status ${status}`);
		this.name = "FotovidError";
		this.status = status;
		this.detail = detail;
	}
}
