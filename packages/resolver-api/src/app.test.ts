import type { AgentSpec } from "@grayhaven/agentgate-schema";
import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";

const testSpec: AgentSpec = {
	version: "1.0",
	service: {
		name: "stripe",
		description: "Payment processing",
		baseUrl: "https://api.stripe.com",
	},
	auth: { type: "bearer", envVar: "STRIPE_KEY" },
	intents: [
		{
			id: "create_charge",
			description: "Create a charge",
			patterns: ["charge {customer} {amount}"],
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
					description: "Amount",
					in: "body",
					transform: "cents",
				},
			],
			response: { type: "object", description: "Charge" },
		},
		{
			id: "get_balance",
			description: "Get account balance",
			patterns: ["get balance", "check balance"],
			endpoint: { method: "GET", path: "/v1/balance" },
			params: [],
			response: { type: "object", description: "Balance" },
		},
	],
};

const emailSpec: AgentSpec = {
	version: "1.0",
	service: {
		name: "resend",
		description: "Email API",
		baseUrl: "https://api.resend.com",
	},
	auth: { type: "bearer", envVar: "RESEND_KEY" },
	intents: [
		{
			id: "send_email",
			description: "Send an email",
			patterns: ["send email to {to}", "email {to}"],
			endpoint: { method: "POST", path: "/emails" },
			params: [
				{
					name: "to",
					type: "string",
					required: true,
					description: "Recipient",
					in: "body",
				},
			],
			response: { type: "object", description: "Email result" },
		},
	],
};

const app = createApp([testSpec, emailSpec]);

describe("GET /health", () => {
	it("returns status with counts", async () => {
		const res = await app.request("/health");
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.status).toBe("ok");
		expect(data.specCount).toBe(2);
		expect(data.intentCount).toBe(3);
	});
});

describe("POST /resolve", () => {
	it("resolves a matching intent", async () => {
		const res = await app.request("/resolve", {
			method: "POST",
			body: JSON.stringify({ intent: "charge cus_123 $49.99" }),
			headers: { "Content-Type": "application/json" },
		});
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.service).toBe("stripe");
		expect(data.intentId).toBe("create_charge");
		expect(data.params.customer).toBe("cus_123");
		expect(data.params.amount).toBe(4999);
		expect(data.confidence).toBeGreaterThan(0);
	});

	it("returns 404 with suggestions for unresolvable intent", async () => {
		const res = await app.request("/resolve", {
			method: "POST",
			body: JSON.stringify({ intent: "make a sandwich" }),
			headers: { "Content-Type": "application/json" },
		});
		expect(res.status).toBe(404);
		const data = await res.json();
		expect(data.error).toContain("No matching");
	});

	it("returns 400 for missing intent field", async () => {
		const res = await app.request("/resolve", {
			method: "POST",
			body: JSON.stringify({}),
			headers: { "Content-Type": "application/json" },
		});
		expect(res.status).toBe(400);
	});

	it("returns 400 for empty POST body (no JSON)", async () => {
		const res = await app.request("/resolve", {
			method: "POST",
		});
		expect(res.status).toBe(400);
		const data = await res.json();
		expect(data.error).toBeDefined();
	});

	it("returns 400 for malformed JSON", async () => {
		const res = await app.request("/resolve", {
			method: "POST",
			body: "not json{{{",
			headers: { "Content-Type": "application/json" },
		});
		expect(res.status).toBe(400);
	});

	it("returns rounded confidence values", async () => {
		const res = await app.request("/resolve", {
			method: "POST",
			body: JSON.stringify({ intent: "charge cus_123 $49.99" }),
			headers: { "Content-Type": "application/json" },
		});
		const data = await res.json();
		// Confidence should be a clean number, not a long float
		const str = String(data.confidence);
		expect(str.length).toBeLessThan(6);
	});

	it("includes alternatives in response", async () => {
		const res = await app.request("/resolve", {
			method: "POST",
			body: JSON.stringify({ intent: "charge cus_abc $10" }),
			headers: { "Content-Type": "application/json" },
		});
		const data = await res.json();
		expect(data.alternatives).toBeDefined();
		expect(Array.isArray(data.alternatives)).toBe(true);
	});
});

describe("GET /discover", () => {
	it("returns matching capabilities", async () => {
		const res = await app.request("/discover?q=email");
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.results.length).toBeGreaterThan(0);
		expect(data.results.some((r: any) => r.service === "resend")).toBe(true);
	});

	it("respects limit parameter", async () => {
		const res = await app.request("/discover?q=charge&limit=1");
		const data = await res.json();
		expect(data.results.length).toBeLessThanOrEqual(1);
	});

	it("returns 400 for missing query", async () => {
		const res = await app.request("/discover");
		expect(res.status).toBe(400);
	});
});

describe("GET /specs", () => {
	it("lists all services", async () => {
		const res = await app.request("/specs");
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.specs).toHaveLength(2);
		expect(data.specs[0].service).toBeDefined();
		expect(data.specs[0].intentCount).toBeDefined();
	});
});

describe("GET /specs/:service", () => {
	it("returns full spec for a service", async () => {
		const res = await app.request("/specs/stripe");
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.service.name).toBe("stripe");
		expect(data.intents).toHaveLength(2);
	});

	it("returns 404 for unknown service", async () => {
		const res = await app.request("/specs/nonexistent");
		expect(res.status).toBe(404);
	});
});
