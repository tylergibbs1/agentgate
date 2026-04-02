import type { AgentSpec } from "@agentgate/schema";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Crawler } from "./crawler.js";

const validSpec: AgentSpec = {
	version: "1.0",
	service: {
		name: "test-api",
		description: "A test API",
		baseUrl: "https://api.test.com",
	},
	auth: { type: "bearer", envVar: "TEST_KEY" },
	intents: [
		{
			id: "do_thing",
			description: "Do a thing",
			patterns: ["do thing {x}"],
			endpoint: { method: "POST", path: "/v1/things" },
			params: [
				{
					name: "x",
					type: "string",
					required: true,
					description: "X",
					in: "body",
				},
			],
			response: { type: "object", description: "Thing" },
		},
	],
};

describe("Crawler", () => {
	beforeEach(() => {
		vi.stubGlobal("fetch", vi.fn());
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("crawls a valid agents.json", async () => {
		vi.mocked(fetch).mockResolvedValue(
			new Response(JSON.stringify(validSpec), {
				status: 200,
				headers: { "content-type": "application/json" },
			}),
		);

		const crawler = new Crawler({ delayMs: 0 });
		const results = await crawler.crawl([{ domain: "test.com" }]);
		expect(results).toHaveLength(1);
		expect(results[0]?.status).toBe("ok");
		expect(results[0]?.spec?.service.name).toBe("test-api");
	});

	it("handles 404", async () => {
		vi.mocked(fetch).mockResolvedValue(new Response("", { status: 404 }));

		const crawler = new Crawler({ delayMs: 0 });
		const results = await crawler.crawl([{ domain: "nospec.com" }]);
		expect(results[0]?.status).toBe("not_found");
	});

	it("handles invalid spec", async () => {
		vi.mocked(fetch).mockResolvedValue(
			new Response(JSON.stringify({ version: "bad" }), {
				status: 200,
				headers: { "content-type": "application/json" },
			}),
		);

		const crawler = new Crawler({ delayMs: 0 });
		const results = await crawler.crawl([{ domain: "bad.com" }]);
		expect(results[0]?.status).toBe("invalid");
		expect(results[0]?.errors?.length).toBeGreaterThan(0);
	});

	it("handles network error", async () => {
		vi.mocked(fetch).mockRejectedValue(new Error("ECONNREFUSED"));

		const crawler = new Crawler({ delayMs: 0 });
		const results = await crawler.crawl([{ domain: "down.com" }]);
		expect(results[0]?.status).toBe("error");
		expect(results[0]?.errors?.[0]).toContain("ECONNREFUSED");
	});

	it("handles server error", async () => {
		vi.mocked(fetch).mockResolvedValue(
			new Response("Internal Server Error", { status: 500 }),
		);

		const crawler = new Crawler({ delayMs: 0 });
		const results = await crawler.crawl([{ domain: "broken.com" }]);
		expect(results[0]?.status).toBe("error");
	});

	it("uses custom URL when provided", async () => {
		vi.mocked(fetch).mockResolvedValue(
			new Response(JSON.stringify(validSpec), {
				status: 200,
				headers: { "content-type": "application/json" },
			}),
		);

		const crawler = new Crawler({ delayMs: 0 });
		await crawler.crawl([
			{ domain: "custom.com", url: "https://custom.com/api/agents.json" },
		]);

		expect(vi.mocked(fetch)).toHaveBeenCalledWith(
			"https://custom.com/api/agents.json",
			expect.any(Object),
		);
	});

	it("crawls multiple domains", async () => {
		let callCount = 0;
		vi.mocked(fetch).mockImplementation(async () => {
			callCount++;
			if (callCount === 1) {
				return new Response(JSON.stringify(validSpec), {
					status: 200,
					headers: { "content-type": "application/json" },
				});
			}
			return new Response("", { status: 404 });
		});

		const crawler = new Crawler({ delayMs: 0, concurrency: 2 });
		const results = await crawler.crawl([
			{ domain: "good.com" },
			{ domain: "empty.com" },
		]);
		expect(results).toHaveLength(2);
		expect(results.filter((r) => r.status === "ok")).toHaveLength(1);
		expect(results.filter((r) => r.status === "not_found")).toHaveLength(1);
	});

	it("builds index from results", async () => {
		vi.mocked(fetch).mockResolvedValue(
			new Response(JSON.stringify(validSpec), {
				status: 200,
				headers: { "content-type": "application/json" },
			}),
		);

		const crawler = new Crawler({ delayMs: 0 });
		const results = await crawler.crawl([{ domain: "test.com" }]);
		const index = crawler.buildIndex(results);

		expect(index.version).toBe("1.0");
		expect(index.entries).toHaveLength(1);
		expect(index.entries[0]?.service).toBe("test-api");
		expect(index.entries[0]?.intentCount).toBe(1);
		expect(index.entries[0]?.intents[0]?.id).toBe("do_thing");
	});

	it("filters out non-ok results from index", async () => {
		const crawler = new Crawler({ delayMs: 0 });
		const index = crawler.buildIndex([
			{
				domain: "a.com",
				url: "https://a.com/.well-known/agents.json",
				status: "ok",
				spec: validSpec,
				crawledAt: new Date().toISOString(),
			},
			{
				domain: "b.com",
				url: "https://b.com/.well-known/agents.json",
				status: "not_found",
				crawledAt: new Date().toISOString(),
			},
		]);
		expect(index.entries).toHaveLength(1);
	});
});
