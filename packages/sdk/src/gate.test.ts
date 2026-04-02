import type { AgentSpec } from "@grayhaven/agentgate-schema";
import { describe, expect, it, vi } from "vitest";
import { AuthError, ResolutionError } from "./errors.js";
import { Gate } from "./gate.js";
import type { DryRunResult } from "./gate.js";

const testSpec: AgentSpec = {
	version: "1.0",
	service: {
		name: "test-api",
		description: "A test API",
		baseUrl: "https://api.test.com",
	},
	auth: { type: "bearer", envVar: "TEST_KEY" },
	intents: [
		{
			id: "create_thing",
			description: "Create a thing",
			patterns: ["create thing {name}"],
			endpoint: { method: "POST", path: "/v1/things" },
			params: [
				{
					name: "name",
					type: "string",
					required: true,
					description: "Thing name",
					in: "body",
				},
			],
			response: { type: "object", description: "Created thing" },
		},
	],
};

describe("Gate", () => {
	describe("dry run", () => {
		it("resolves intent without executing", async () => {
			const gate = new Gate({
				specs: [testSpec],
				dryRun: true,
			});

			const result = (await gate.do("create thing my-widget")) as DryRunResult;
			expect(result.service).toBe("test-api");
			expect(result.intentId).toBe("create_thing");
			expect(result.params.name).toBe("my-widget");
			expect(result.endpoint.method).toBe("POST");
			expect(result.endpoint.url).toBe("https://api.test.com/v1/things");
		});

		it("logs the resolution", async () => {
			const gate = new Gate({ specs: [testSpec], dryRun: true });
			await gate.do("create thing test-item");
			expect(gate.logs).toHaveLength(1);
			expect(gate.logs[0]?.type).toBe("resolution");
			expect(gate.logs[0]?.intentId).toBe("create_thing");
		});
	});

	describe("execution", () => {
		it("calls the API and returns result", async () => {
			const mockExecutor = {
				execute: vi.fn().mockResolvedValue({
					data: { id: "thing_1", name: "my-widget" },
					status: 200,
					headers: { "content-type": "application/json" },
					durationMs: 42,
				}),
			};

			const gate = new Gate({
				specs: [testSpec],
				keys: { "test-api": "sk_test_123" },
				executor: mockExecutor,
			});

			const result = await gate.do("create thing my-widget");
			expect(result.service).toBe("test-api");
			expect(result.intentId).toBe("create_thing");
			expect((result as any).data.id).toBe("thing_1");

			expect(mockExecutor.execute).toHaveBeenCalledOnce();
			const [resolved, auth] = mockExecutor.execute.mock.calls[0]!;
			expect(resolved.endpoint.url).toBe("https://api.test.com/v1/things");
			expect(auth.value).toBe("Bearer sk_test_123");
		});

		it("logs the execution", async () => {
			const gate = new Gate({
				specs: [testSpec],
				keys: { "test-api": "sk_test_123" },
				executor: {
					execute: vi.fn().mockResolvedValue({
						data: {},
						status: 200,
						headers: {},
						durationMs: 10,
					}),
				},
			});

			await gate.do("create thing item");
			expect(gate.logs).toHaveLength(1);
			expect(gate.logs[0]?.type).toBe("execution");
		});
	});

	describe("errors", () => {
		it("throws ResolutionError for unresolvable intent", async () => {
			const gate = new Gate({ specs: [testSpec], dryRun: true });
			await expect(gate.do("do something random")).rejects.toThrow(
				ResolutionError,
			);
		});

		it("throws ResolutionError with suggestions", async () => {
			const gate = new Gate({ specs: [testSpec], dryRun: true });
			try {
				await gate.do("create a new thing");
				expect.unreachable("should have thrown");
			} catch (e) {
				expect(e).toBeInstanceOf(ResolutionError);
				const err = e as ResolutionError;
				expect(err.suggestions.length).toBeGreaterThan(0);
			}
		});

		it("throws AuthError when key is missing", async () => {
			const gate = new Gate({ specs: [testSpec] });
			await expect(gate.do("create thing test")).rejects.toThrow(AuthError);
		});
	});

	describe("discover", () => {
		it("returns matching intents", async () => {
			const gate = new Gate({ specs: [testSpec], dryRun: true });
			const results = await gate.discover("create");
			expect(results.length).toBeGreaterThan(0);
			expect(results[0]?.intentId).toBe("create_thing");
		});
	});

	describe("execution details", () => {
		it("returns timing info", async () => {
			const gate = new Gate({
				specs: [testSpec],
				keys: { "test-api": "sk_test" },
				executor: {
					execute: vi.fn().mockResolvedValue({
						data: {},
						status: 201,
						headers: { "content-type": "application/json" },
						durationMs: 55,
					}),
				},
			});

			const result = await gate.do("create thing widget");
			expect("timing" in result).toBe(true);
			const r = result as any;
			expect(typeof r.timing.resolvedMs).toBe("number");
			expect(typeof r.timing.executedMs).toBe("number");
		});

		it("returns response headers", async () => {
			const gate = new Gate({
				specs: [testSpec],
				keys: { "test-api": "sk_test" },
				executor: {
					execute: vi.fn().mockResolvedValue({
						data: {},
						status: 200,
						headers: { "x-request-id": "req_abc" },
						durationMs: 10,
					}),
				},
			});

			const result = await gate.do("create thing widget");
			const r = result as any;
			expect(r.response.headers["x-request-id"]).toBe("req_abc");
		});

		it("sets body in request for POST", async () => {
			const gate = new Gate({
				specs: [testSpec],
				keys: { "test-api": "sk_test" },
				executor: {
					execute: vi.fn().mockResolvedValue({
						data: {},
						status: 200,
						headers: {},
						durationMs: 10,
					}),
				},
			});

			const result = await gate.do("create thing foo");
			const r = result as any;
			expect(r.request.body).toEqual({ name: "foo" });
			expect(r.request.method).toBe("POST");
		});

		it("omits body for GET methods", async () => {
			const getSpec: AgentSpec = {
				version: "1.0",
				service: {
					name: "test-api",
					description: "Test",
					baseUrl: "https://api.test.com",
				},
				auth: { type: "bearer", envVar: "TEST_KEY" },
				intents: [
					{
						id: "list_things",
						description: "List things",
						patterns: ["list things"],
						endpoint: { method: "GET", path: "/v1/things" },
						params: [],
						response: { type: "array", description: "Things" },
					},
				],
			};
			const gate = new Gate({
				specs: [getSpec],
				keys: { "test-api": "sk_test" },
				executor: {
					execute: vi.fn().mockResolvedValue({
						data: [],
						status: 200,
						headers: {},
						durationMs: 5,
					}),
				},
			});

			const result = await gate.do("list things");
			const r = result as any;
			expect(r.request.body).toBeUndefined();
		});

		it("accumulates multiple log entries", async () => {
			const gate = new Gate({
				specs: [testSpec],
				keys: { "test-api": "sk_test" },
				executor: {
					execute: vi.fn().mockResolvedValue({
						data: {},
						status: 200,
						headers: {},
						durationMs: 1,
					}),
				},
			});

			await gate.do("create thing a");
			await gate.do("create thing b");
			expect(gate.logs).toHaveLength(2);
			expect(gate.logs[0]?.input).toBe("create thing a");
			expect(gate.logs[1]?.input).toBe("create thing b");
		});

		it("logs include request details", async () => {
			const gate = new Gate({
				specs: [testSpec],
				keys: { "test-api": "sk_test" },
				executor: {
					execute: vi.fn().mockResolvedValue({
						data: {},
						status: 200,
						headers: {},
						durationMs: 10,
					}),
				},
			});

			await gate.do("create thing widget");
			const log = gate.logs[0]!;
			expect(log.request?.method).toBe("POST");
			expect(log.request?.url).toBe("https://api.test.com/v1/things");
			expect(log.request?.body).toEqual({ name: "widget" });
			expect(log.response?.status).toBe(200);
			expect(log.response?.durationMs).toBe(10);
		});
	});

	describe("multi-spec disambiguation", () => {
		it("resolves across multiple specs", async () => {
			const specA: AgentSpec = {
				version: "1.0",
				service: {
					name: "svc-a",
					description: "Service A",
					baseUrl: "https://a.com",
				},
				auth: { type: "bearer", envVar: "A_KEY" },
				intents: [
					{
						id: "do_a",
						description: "Do A",
						patterns: ["do a {x}"],
						endpoint: { method: "POST", path: "/a" },
						params: [
							{
								name: "x",
								type: "string",
								required: true,
								description: "X",
								in: "body",
							},
						],
						response: { type: "object", description: "A" },
					},
				],
			};
			const specB: AgentSpec = {
				version: "1.0",
				service: {
					name: "svc-b",
					description: "Service B",
					baseUrl: "https://b.com",
				},
				auth: { type: "bearer", envVar: "B_KEY" },
				intents: [
					{
						id: "do_b",
						description: "Do B",
						patterns: ["do b {x}"],
						endpoint: { method: "POST", path: "/b" },
						params: [
							{
								name: "x",
								type: "string",
								required: true,
								description: "X",
								in: "body",
							},
						],
						response: { type: "object", description: "B" },
					},
				],
			};

			const gate = new Gate({ specs: [specA, specB], dryRun: true });
			const resultA = (await gate.do("do a hello")) as DryRunResult;
			expect(resultA.service).toBe("svc-a");
			expect(resultA.intentId).toBe("do_a");

			const resultB = (await gate.do("do b world")) as DryRunResult;
			expect(resultB.service).toBe("svc-b");
			expect(resultB.intentId).toBe("do_b");
		});
	});

	describe("dry run details", () => {
		it("includes confidence score", async () => {
			const gate = new Gate({ specs: [testSpec], dryRun: true });
			const result = (await gate.do("create thing foo")) as DryRunResult;
			expect(result.confidence).toBeGreaterThan(0);
			expect(result.confidence).toBeLessThanOrEqual(1.1);
		});

		it("includes description", async () => {
			const gate = new Gate({ specs: [testSpec], dryRun: true });
			const result = (await gate.do("create thing foo")) as DryRunResult;
			expect(result.description).toBe("Create a thing");
		});

		it("includes empty alternatives when no ambiguity", async () => {
			const gate = new Gate({ specs: [testSpec], dryRun: true });
			const result = (await gate.do("create thing foo")) as DryRunResult;
			expect(result.alternatives).toEqual([]);
		});
	});

	describe("custom injections", () => {
		it("accepts a custom logger", async () => {
			const entries: any[] = [];
			const customLogger = {
				log: (entry: any) => entries.push(entry),
				entries: () => entries,
			};
			const gate = new Gate({
				specs: [testSpec],
				dryRun: true,
				logger: customLogger,
			});
			await gate.do("create thing foo");
			expect(entries).toHaveLength(1);
			expect(entries[0].intentId).toBe("create_thing");
		});

		it("accepts a custom resolver", async () => {
			const customResolver = {
				resolve: () => ({
					service: "custom",
					intentId: "custom_intent",
					description: "Custom",
					endpoint: { method: "GET", url: "https://custom.com/api" },
					params: {},
					confidence: 1,
					alternatives: [],
				}),
				discover: () => [],
			};
			const gate = new Gate({
				specs: [],
				dryRun: true,
				resolver: customResolver,
			});
			const result = (await gate.do("anything")) as DryRunResult;
			expect(result.service).toBe("custom");
			expect(result.intentId).toBe("custom_intent");
		});
	});
});
