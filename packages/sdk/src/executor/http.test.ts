import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExecutionError } from "../errors.js";
import type { ResolvedIntent } from "../resolver/types.js";
import { HttpExecutor } from "./http.js";

function makeResolved(overrides?: Partial<ResolvedIntent>): ResolvedIntent {
	return {
		service: "test",
		intentId: "test_intent",
		description: "Test intent",
		endpoint: { method: "POST", url: "https://api.test.com/v1/things" },
		params: { name: "widget" },
		confidence: 1,
		alternatives: [],
		...overrides,
	};
}

const auth = { name: "Authorization", value: "Bearer sk_test" };

describe("HttpExecutor", () => {
	const executor = new HttpExecutor();

	beforeEach(() => {
		vi.stubGlobal("fetch", vi.fn());
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("sends POST with JSON body", async () => {
		const mockFetch = vi.mocked(fetch);
		mockFetch.mockResolvedValue(
			new Response(JSON.stringify({ id: "thing_1" }), {
				status: 200,
				headers: { "content-type": "application/json" },
			}),
		);

		const result = await executor.execute(makeResolved(), auth);

		expect(mockFetch).toHaveBeenCalledOnce();
		const [url, opts] = mockFetch.mock.calls[0]!;
		expect(url).toBe("https://api.test.com/v1/things");
		expect(opts?.method).toBe("POST");
		expect(opts?.body).toBe(JSON.stringify({ name: "widget" }));
		expect(opts?.headers).toMatchObject({
			"Content-Type": "application/json",
			Authorization: "Bearer sk_test",
		});

		expect(result.data).toEqual({ id: "thing_1" });
		expect(result.status).toBe(200);
		expect(result.durationMs).toBeGreaterThanOrEqual(0);
	});

	it("sends GET with query params (no body)", async () => {
		const mockFetch = vi.mocked(fetch);
		mockFetch.mockResolvedValue(
			new Response(JSON.stringify([]), {
				status: 200,
				headers: { "content-type": "application/json" },
			}),
		);

		await executor.execute(
			makeResolved({
				endpoint: { method: "GET", url: "https://api.test.com/v1/items" },
				params: { limit: 10, status: "active" },
			}),
			auth,
		);

		const [url, opts] = vi.mocked(fetch).mock.calls[0]!;
		expect(url).toContain("?");
		expect(url).toContain("limit=10");
		expect(url).toContain("status=active");
		expect(opts?.method).toBe("GET");
		expect(opts?.body).toBeUndefined();
	});

	it("sends DELETE with query params (no body)", async () => {
		const mockFetch = vi.mocked(fetch);
		mockFetch.mockResolvedValue(
			new Response(null, { status: 204, headers: {} }),
		);

		await executor.execute(
			makeResolved({
				endpoint: {
					method: "DELETE",
					url: "https://api.test.com/v1/items/123",
				},
				params: {},
			}),
			auth,
		);

		const [url, opts] = mockFetch.mock.calls[0]!;
		expect(url).toBe("https://api.test.com/v1/items/123");
		expect(opts?.method).toBe("DELETE");
		expect(opts?.body).toBeUndefined();
	});

	it("sends PUT with JSON body", async () => {
		const mockFetch = vi.mocked(fetch);
		mockFetch.mockResolvedValue(
			new Response(JSON.stringify({ updated: true }), {
				status: 200,
				headers: { "content-type": "application/json" },
			}),
		);

		await executor.execute(
			makeResolved({
				endpoint: { method: "PUT", url: "https://api.test.com/v1/items/123" },
				params: { name: "updated-widget" },
			}),
			auth,
		);

		const [, opts] = mockFetch.mock.calls[0]!;
		expect(opts?.method).toBe("PUT");
		expect(opts?.body).toBe(JSON.stringify({ name: "updated-widget" }));
	});

	it("sends PATCH with JSON body", async () => {
		const mockFetch = vi.mocked(fetch);
		mockFetch.mockResolvedValue(
			new Response(JSON.stringify({}), {
				status: 200,
				headers: { "content-type": "application/json" },
			}),
		);

		await executor.execute(
			makeResolved({
				endpoint: { method: "PATCH", url: "https://api.test.com/v1/items/123" },
				params: { status: "done" },
			}),
			auth,
		);

		const [, opts] = mockFetch.mock.calls[0]!;
		expect(opts?.method).toBe("PATCH");
		expect(opts?.body).toBe(JSON.stringify({ status: "done" }));
	});

	it("throws ExecutionError on non-2xx response with details", async () => {
		vi.mocked(fetch).mockResolvedValue(
			new Response(JSON.stringify({ error: "not found" }), {
				status: 404,
				headers: { "content-type": "application/json" },
			}),
		);

		try {
			await executor.execute(makeResolved(), auth);
			expect.unreachable("should have thrown");
		} catch (e) {
			expect(e).toBeInstanceOf(ExecutionError);
			const err = e as ExecutionError;
			expect(err.status).toBe(404);
			expect(err.response).toEqual({ error: "not found" });
		}
	});

	it("handles non-JSON response as text", async () => {
		vi.mocked(fetch).mockResolvedValue(
			new Response("OK", {
				status: 200,
				headers: { "content-type": "text/plain" },
			}),
		);

		const result = await executor.execute(makeResolved(), auth);
		expect(result.data).toBe("OK");
	});

	it("captures response headers", async () => {
		vi.mocked(fetch).mockResolvedValue(
			new Response(JSON.stringify({}), {
				status: 200,
				headers: {
					"content-type": "application/json",
					"x-request-id": "req_123",
				},
			}),
		);

		const result = await executor.execute(makeResolved(), auth);
		expect(result.headers["x-request-id"]).toBe("req_123");
	});

	it("skips query string when GET has no params", async () => {
		vi.mocked(fetch).mockResolvedValue(
			new Response(JSON.stringify({}), {
				status: 200,
				headers: { "content-type": "application/json" },
			}),
		);

		await executor.execute(
			makeResolved({
				endpoint: { method: "GET", url: "https://api.test.com/v1/balance" },
				params: {},
			}),
			auth,
		);

		const [url] = vi.mocked(fetch).mock.calls[0]!;
		expect(url).toBe("https://api.test.com/v1/balance");
		expect(url).not.toContain("?");
	});

	it("measures timing", async () => {
		vi.mocked(fetch).mockResolvedValue(
			new Response(JSON.stringify({}), {
				status: 200,
				headers: { "content-type": "application/json" },
			}),
		);

		const result = await executor.execute(makeResolved(), auth);
		expect(typeof result.durationMs).toBe("number");
		expect(result.durationMs).toBeGreaterThanOrEqual(0);
	});

	it("throws ExecutionError on 500", async () => {
		vi.mocked(fetch).mockResolvedValue(
			new Response(JSON.stringify({ error: "internal" }), {
				status: 500,
				headers: { "content-type": "application/json" },
			}),
		);

		await expect(executor.execute(makeResolved(), auth)).rejects.toThrow(
			ExecutionError,
		);
	});

	it("handles error response as text when not JSON", async () => {
		vi.mocked(fetch).mockResolvedValue(
			new Response("Internal Server Error", {
				status: 500,
				headers: { "content-type": "text/plain" },
			}),
		);

		try {
			await executor.execute(makeResolved(), auth);
		} catch (e) {
			const err = e as ExecutionError;
			expect(err.status).toBe(500);
			expect(err.response).toBe("Internal Server Error");
		}
	});
});
