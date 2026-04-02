import type { AuthHeader } from "../auth/types.js";
import { ExecutionError } from "../errors.js";
import type { ResolvedIntent } from "../resolver/types.js";
import type { ExecutionResult, Executor } from "./types.js";

export class HttpExecutor implements Executor {
	async execute(
		resolved: ResolvedIntent,
		auth: AuthHeader | null,
	): Promise<ExecutionResult> {
		const { method, url } = resolved.endpoint;
		const isFormEncoded =
			resolved.contentType === "application/x-www-form-urlencoded";

		const headers: Record<string, string> = {
			"Content-Type": resolved.contentType ?? "application/json",
		};
		if (auth) {
			headers[auth.name] = auth.value;
		}

		const hasBody = method !== "GET" && method !== "DELETE";
		let finalUrl = url;
		let body: string | undefined;

		if (hasBody) {
			if (isFormEncoded) {
				const formParams = new URLSearchParams();
				for (const [key, value] of Object.entries(resolved.params)) {
					if (value !== undefined && value !== null) {
						formParams.set(key, String(value));
					}
				}
				body = formParams.toString();
			} else {
				body = JSON.stringify(resolved.params);
			}
		} else {
			const queryParams = new URLSearchParams();
			for (const [key, value] of Object.entries(resolved.params)) {
				queryParams.set(key, String(value));
			}
			const qs = queryParams.toString();
			if (qs) {
				finalUrl = `${url}?${qs}`;
			}
		}

		const start = performance.now();
		const response = await fetch(finalUrl, {
			method,
			headers,
			body,
		});
		const durationMs = Math.round(performance.now() - start);

		const responseHeaders: Record<string, string> = {};
		response.headers.forEach((value, key) => {
			responseHeaders[key] = value;
		});

		let data: unknown;
		const contentType = response.headers.get("content-type") ?? "";
		if (contentType.includes("application/json")) {
			data = await response.json();
		} else {
			data = await response.text();
		}

		if (!response.ok) {
			throw new ExecutionError(response.status, data);
		}

		return {
			data,
			status: response.status,
			headers: responseHeaders,
			durationMs,
		};
	}
}
