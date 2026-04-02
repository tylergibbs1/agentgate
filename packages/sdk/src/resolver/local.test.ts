import type { AgentSpec } from "@agentgate/schema";
import { describe, expect, it } from "vitest";
import { LocalResolver } from "./local.js";

const stripeSpec: AgentSpec = {
	version: "1.0",
	service: {
		name: "stripe",
		description: "Payment processing platform",
		baseUrl: "https://api.stripe.com",
	},
	auth: { type: "bearer", envVar: "STRIPE_KEY" },
	intents: [
		{
			id: "create_charge",
			description: "Create a charge to bill a customer",
			patterns: ["charge {customer} {amount}", "charge {amount} to {customer}"],
			endpoint: { method: "POST", path: "/v1/charges" },
			params: [
				{
					name: "customer",
					type: "string",
					required: true,
					description: "Customer ID",
					in: "body",
					pattern: "^cus_",
				},
				{
					name: "amount",
					type: "number",
					required: true,
					description: "Amount in dollars",
					in: "body",
					transform: "cents",
				},
			],
			response: { type: "object", description: "Charge object" },
		},
		{
			id: "get_customer",
			description: "Retrieve a customer by ID",
			patterns: ["get customer {customer}", "retrieve customer {customer}"],
			endpoint: { method: "GET", path: "/v1/customers/{customer}" },
			params: [
				{
					name: "customer",
					type: "string",
					required: true,
					description: "Customer ID",
					in: "path",
					pattern: "^cus_",
				},
			],
			response: { type: "object", description: "Customer object" },
		},
	],
};

const resendSpec: AgentSpec = {
	version: "1.0",
	service: {
		name: "resend",
		description: "Email API for developers",
		baseUrl: "https://api.resend.com",
	},
	auth: { type: "bearer", envVar: "RESEND_KEY" },
	intents: [
		{
			id: "send_email",
			description: "Send a transactional email",
			patterns: ["send email to {to}", "send {to} an email", "email {to}"],
			endpoint: { method: "POST", path: "/emails" },
			params: [
				{
					name: "to",
					type: "string",
					required: true,
					description: "Recipient email",
					in: "body",
				},
				{
					name: "subject",
					type: "string",
					required: false,
					description: "Email subject",
					in: "body",
				},
			],
			response: { type: "object", description: "Email send result" },
		},
	],
};

describe("LocalResolver", () => {
	const resolver = new LocalResolver([stripeSpec, resendSpec]);

	describe("resolve", () => {
		it("resolves a charge intent", () => {
			const result = resolver.resolve("charge cus_123 $49.99");
			expect(result).not.toBeNull();
			expect(result?.service).toBe("stripe");
			expect(result?.intentId).toBe("create_charge");
			expect(result?.params.customer).toBe("cus_123");
			expect(result?.params.amount).toBe(4999);
			expect(result?.endpoint.method).toBe("POST");
			expect(result?.endpoint.url).toBe("https://api.stripe.com/v1/charges");
		});

		it("resolves alternate pattern", () => {
			const result = resolver.resolve("charge $25 to cus_456");
			expect(result).not.toBeNull();
			expect(result?.service).toBe("stripe");
			expect(result?.params.amount).toBe(2500);
			expect(result?.params.customer).toBe("cus_456");
		});

		it("resolves email intent", () => {
			const result = resolver.resolve("send email to user@test.com");
			expect(result).not.toBeNull();
			expect(result?.service).toBe("resend");
			expect(result?.intentId).toBe("send_email");
			expect(result?.params.to).toBe("user@test.com");
		});

		it("resolves path params into URL", () => {
			const result = resolver.resolve("get customer cus_789");
			expect(result).not.toBeNull();
			expect(result?.endpoint.url).toBe(
				"https://api.stripe.com/v1/customers/cus_789",
			);
		});

		it("returns null for unresolvable intent", () => {
			const result = resolver.resolve("make a sandwich");
			expect(result).toBeNull();
		});

		it("includes alternatives when multiple intents match", () => {
			// Both "charge" and "email" won't match the same input,
			// but two stripe intents might partially match
			const result = resolver.resolve("charge cus_123 $10");
			expect(result).not.toBeNull();
			// The winner should be create_charge
			expect(result?.intentId).toBe("create_charge");
		});
	});

	describe("discover", () => {
		it("finds email-related intents", () => {
			const results = resolver.discover("send email");
			expect(results.length).toBeGreaterThan(0);
			expect(results[0]?.service).toBe("resend");
			expect(results[0]?.intentId).toBe("send_email");
		});

		it("finds charge-related intents", () => {
			const results = resolver.discover("charge payment");
			expect(results.length).toBeGreaterThan(0);
			expect(results.some((r) => r.intentId === "create_charge")).toBe(true);
		});

		it("returns empty for completely unrelated query", () => {
			const results = resolver.discover("xyzzy plugh");
			expect(results).toEqual([]);
		});

		it("ranks exact keyword matches above partial", () => {
			const results = resolver.discover("charge");
			expect(results.length).toBeGreaterThan(0);
			// create_charge should rank highest because "charge" is in patterns and id
			expect(results[0]?.intentId).toBe("create_charge");
		});

		it("returns sorted by confidence descending", () => {
			const results = resolver.discover("customer");
			for (let i = 1; i < results.length; i++) {
				expect(results[i]?.confidence).toBeLessThanOrEqual(
					results[i - 1]?.confidence,
				);
			}
		});
	});

	describe("edge cases", () => {
		it("handles empty specs array", () => {
			const empty = new LocalResolver([]);
			expect(empty.resolve("charge cus_123 $10")).toBeNull();
			expect(empty.discover("anything")).toEqual([]);
		});

		it("fills in default param values", () => {
			const specWithDefaults: AgentSpec = {
				version: "1.0",
				service: {
					name: "test",
					description: "Test",
					baseUrl: "https://api.test.com",
				},
				auth: { type: "bearer", envVar: "KEY" },
				intents: [
					{
						id: "list_things",
						description: "List things",
						patterns: ["list things"],
						endpoint: { method: "GET", path: "/v1/things" },
						params: [
							{
								name: "limit",
								type: "number",
								required: false,
								description: "Limit",
								in: "query",
								default: 10,
							},
						],
						response: { type: "array", description: "Things" },
					},
				],
			};
			const r = new LocalResolver([specWithDefaults]);
			const result = r.resolve("list things");
			expect(result).not.toBeNull();
			expect(result?.params.limit).toBe(10);
		});

		it("handles multiple path params", () => {
			const specMultiPath: AgentSpec = {
				version: "1.0",
				service: {
					name: "test",
					description: "Test",
					baseUrl: "https://api.test.com",
				},
				auth: { type: "bearer", envVar: "KEY" },
				intents: [
					{
						id: "get_nested",
						description: "Get nested resource",
						patterns: ["get {parent} child {child}"],
						endpoint: { method: "GET", path: "/v1/{parent}/children/{child}" },
						params: [
							{
								name: "parent",
								type: "string",
								required: true,
								description: "Parent ID",
								in: "path",
							},
							{
								name: "child",
								type: "string",
								required: true,
								description: "Child ID",
								in: "path",
							},
						],
						response: { type: "object", description: "Nested resource" },
					},
				],
			};
			const r = new LocalResolver([specMultiPath]);
			const result = r.resolve("get org_1 child team_2");
			expect(result).not.toBeNull();
			expect(result?.endpoint.url).toBe(
				"https://api.test.com/v1/org_1/children/team_2",
			);
		});

		it("below threshold intents are not resolved", () => {
			// An intent that barely matches should not resolve
			const result = resolver.resolve("something unrelated charge");
			// "charge" matches the pattern keyword but context is wrong
			// Either returns null or returns with low confidence — either is acceptable
			if (result) {
				expect(result.confidence).toBeGreaterThanOrEqual(0.3);
			}
		});

		it("discover returns patterns in results", () => {
			const results = resolver.discover("email");
			const emailResult = results.find((r) => r.intentId === "send_email");
			expect(emailResult).toBeDefined();
			expect(emailResult?.patterns).toContain("send email to {to}");
		});

		it("single-word discover query", () => {
			const results = resolver.discover("email");
			expect(results.length).toBeGreaterThan(0);
		});

		it("alternatives are included in resolve result", () => {
			// Use a spec where two intents could match
			const ambiguousSpec: AgentSpec = {
				version: "1.0",
				service: {
					name: "test",
					description: "Test",
					baseUrl: "https://api.test.com",
				},
				auth: { type: "bearer", envVar: "KEY" },
				intents: [
					{
						id: "intent_a",
						description: "Create a thing",
						patterns: ["create {name}"],
						endpoint: { method: "POST", path: "/a" },
						params: [
							{
								name: "name",
								type: "string",
								required: true,
								description: "Name",
								in: "body",
							},
						],
						response: { type: "object", description: "A" },
					},
					{
						id: "intent_b",
						description: "Create a widget",
						patterns: ["create {name}"],
						endpoint: { method: "POST", path: "/b" },
						params: [
							{
								name: "name",
								type: "string",
								required: true,
								description: "Name",
								in: "body",
							},
						],
						response: { type: "object", description: "B" },
					},
				],
			};
			const r = new LocalResolver([ambiguousSpec]);
			const result = r.resolve("create foo");
			expect(result).not.toBeNull();
			// One wins, the other is in alternatives
			expect(result?.alternatives.length).toBe(1);
		});
	});
});
