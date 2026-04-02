import { describe, expect, it } from "vitest";
import type { AgentSpec } from "./types.js";
import { validateSpec } from "./validator.js";

function makeValidSpec(overrides?: Partial<AgentSpec>): unknown {
	return {
		version: "1.0",
		service: {
			name: "test-service",
			description: "A test service",
			baseUrl: "https://api.test.com",
		},
		auth: {
			type: "bearer",
			envVar: "TEST_API_KEY",
		},
		intents: [
			{
				id: "test_intent",
				description: "A test intent",
				patterns: ["test {param}"],
				endpoint: { method: "POST", path: "/v1/test" },
				params: [
					{
						name: "param",
						type: "string",
						required: true,
						description: "A test param",
						in: "body",
					},
				],
				response: {
					type: "object",
					description: "Test response",
				},
			},
		],
		...overrides,
	};
}

describe("validateSpec", () => {
	it("accepts a valid spec", () => {
		const result = validateSpec(makeValidSpec());
		expect(result.valid).toBe(true);
		expect(result.errors).toEqual([]);
		expect(result.spec).not.toBeNull();
		expect(result.spec?.service.name).toBe("test-service");
	});

	it("rejects missing version", () => {
		const spec = makeValidSpec();
		(spec as Record<string, unknown>).version = undefined;
		const result = validateSpec(spec);
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes("version"))).toBe(true);
	});

	it("rejects wrong version", () => {
		const result = validateSpec(makeValidSpec({ version: "2.0" as "1.0" }));
		expect(result.valid).toBe(false);
	});

	it("rejects empty intents array", () => {
		const result = validateSpec(makeValidSpec({ intents: [] }));
		expect(result.valid).toBe(false);
	});

	it("rejects invalid auth type", () => {
		const result = validateSpec(
			makeValidSpec({ auth: { type: "magic" as "bearer", envVar: "KEY" } }),
		);
		expect(result.valid).toBe(false);
	});

	it("rejects invalid HTTP method", () => {
		const spec = makeValidSpec();
		(spec as any).intents[0].endpoint.method = "YEET";
		const result = validateSpec(spec);
		expect(result.valid).toBe(false);
	});

	it("rejects baseUrl without http(s)", () => {
		const spec = makeValidSpec();
		(spec as any).service.baseUrl = "ftp://bad.com";
		const result = validateSpec(spec);
		expect(result.valid).toBe(false);
	});

	it("accepts optional fields", () => {
		const spec = makeValidSpec();
		(spec as any).intents[0].params[0].transform = "cents";
		(spec as any).intents[0].params[0].pattern = "^test_";
		(spec as any).intents[0].params[0].default = "hello";
		(spec as any).intents[0].flow = [
			{
				intentId: "other_intent",
				description: "Chain to other",
				mapParams: { id: "result.id" },
			},
		];
		const result = validateSpec(spec);
		expect(result.valid).toBe(true);
	});

	it("rejects additional properties at top level", () => {
		const spec = makeValidSpec();
		(spec as any).extra = "nope";
		const result = validateSpec(spec);
		expect(result.valid).toBe(false);
	});

	it("returns all errors at once", () => {
		const result = validateSpec({});
		expect(result.valid).toBe(false);
		expect(result.errors.length).toBeGreaterThan(1);
	});
});
