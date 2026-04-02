import { describe, expect, it } from "vitest";
import { searchIntents } from "./search.js";
import type { ServiceSummary } from "./specs.js";

const services: ServiceSummary[] = [
	{
		name: "stripe",
		description: "Payment processing",
		baseUrl: "https://api.stripe.com",
		authType: "bearer",
		intentCount: 2,
		intents: [
			{
				id: "create_charge",
				description: "Create a charge to bill a customer",
				patterns: ["charge {customer} {amount}"],
				method: "POST",
				path: "/v1/charges",
				paramCount: 2,
			},
			{
				id: "get_balance",
				description: "Get account balance",
				patterns: ["get balance"],
				method: "GET",
				path: "/v1/balance",
				paramCount: 0,
			},
		],
	},
	{
		name: "resend",
		description: "Email API",
		baseUrl: "https://api.resend.com",
		authType: "bearer",
		intentCount: 1,
		intents: [
			{
				id: "send_email",
				description: "Send a transactional email",
				patterns: ["send email to {to}"],
				method: "POST",
				path: "/emails",
				paramCount: 1,
			},
		],
	},
];

describe("searchIntents", () => {
	it("finds email intents", () => {
		const results = searchIntents("send email", services);
		expect(results.length).toBeGreaterThan(0);
		expect(results[0]?.intentId).toBe("send_email");
	});

	it("finds charge intents", () => {
		const results = searchIntents("charge", services);
		expect(results.some((r) => r.intentId === "create_charge")).toBe(true);
	});

	it("returns empty for no match", () => {
		expect(searchIntents("xyzzy", services)).toEqual([]);
	});

	it("returns empty for empty query", () => {
		expect(searchIntents("", services)).toEqual([]);
	});

	it("sorts by score descending", () => {
		const results = searchIntents("send", services);
		for (let i = 1; i < results.length; i++) {
			expect(results[i]?.score).toBeLessThanOrEqual(results[i - 1]?.score);
		}
	});

	it("matches by service name", () => {
		const results = searchIntents("stripe", services);
		expect(results.length).toBeGreaterThan(0);
		expect(results.every((r) => r.service === "stripe")).toBe(true);
	});
});
