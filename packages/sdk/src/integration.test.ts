import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { AgentSpec } from "@agentgate/schema";
import { validateSpec } from "@agentgate/schema";
import { describe, expect, it } from "vitest";
import { Gate } from "./gate.js";
import type { DryRunResult } from "./gate.js";
import { LocalResolver } from "./resolver/local.js";

// Load all real spec files
const specsDir = join(import.meta.dirname, "..", "..", "..", "specs");
const specs: AgentSpec[] = readdirSync(specsDir)
	.filter((f) => f.endsWith(".json"))
	.map((f) => {
		const data = JSON.parse(readFileSync(join(specsDir, f), "utf-8"));
		return data as AgentSpec;
	});

describe("real spec files", () => {
	it("loads all 5 specs", () => {
		expect(specs).toHaveLength(5);
	});

	it("all specs pass validation", () => {
		for (const spec of specs) {
			const result = validateSpec(spec);
			expect(result.valid, `${spec.service.name} should be valid`).toBe(true);
		}
	});

	it("has expected services", () => {
		const names = specs.map((s) => s.service.name).sort();
		expect(names).toEqual(["github", "openai", "resend", "stripe", "twilio"]);
	});

	it("has 25 total intents", () => {
		const total = specs.reduce((sum, s) => sum + s.intents.length, 0);
		expect(total).toBe(26);
	});

	it("all intents have at least one pattern", () => {
		for (const spec of specs) {
			for (const intent of spec.intents) {
				expect(
					intent.patterns.length,
					`${spec.service.name}/${intent.id} should have patterns`,
				).toBeGreaterThan(0);
			}
		}
	});

	it("all intents have unique IDs within their spec", () => {
		for (const spec of specs) {
			const ids = spec.intents.map((i) => i.id);
			expect(
				new Set(ids).size,
				`${spec.service.name} should have unique intent IDs`,
			).toBe(ids.length);
		}
	});
});

describe("cross-spec resolution", () => {
	const gate = new Gate({ specs, dryRun: true });

	it("resolves Stripe charge", async () => {
		const result = (await gate.do("charge cus_abc $99.99")) as DryRunResult;
		expect(result.service).toBe("stripe");
		expect(result.intentId).toBe("create_charge");
		expect(result.params.customer).toBe("cus_abc");
		expect(result.params.amount).toBe(9999);
		expect(result.params.currency).toBe("usd");
	});

	it("resolves Resend email", async () => {
		const result = (await gate.do(
			"send email to alice@example.com",
		)) as DryRunResult;
		expect(result.service).toBe("resend");
		expect(result.intentId).toBe("send_email");
		expect(result.params.to).toBe("alice@example.com");
	});

	it("resolves GitHub list repos", async () => {
		const result = (await gate.do("list repos for octocat")) as DryRunResult;
		expect(result.service).toBe("github");
		expect(result.intentId).toBe("list_repos");
		expect(result.endpoint.url).toContain("octocat");
	});

	it("resolves Stripe refund", async () => {
		const result = (await gate.do("refund charge ch_abc123")) as DryRunResult;
		expect(result.service).toBe("stripe");
		expect(result.intentId).toBe("create_refund");
		expect(result.params.charge).toBe("ch_abc123");
	});

	it("resolves Stripe balance (no params)", async () => {
		const result = (await gate.do("get balance")) as DryRunResult;
		expect(result.service).toBe("stripe");
		expect(result.intentId).toBe("get_balance");
	});

	it("resolves OpenAI image generation", async () => {
		const result = (await gate.do(
			"generate image sunset over mountains",
		)) as DryRunResult;
		expect(result.service).toBe("openai");
		expect(result.intentId).toBe("create_image");
	});

	it("resolves Stripe subscription", async () => {
		const result = (await gate.do(
			"subscribe cus_123 to price_pro",
		)) as DryRunResult;
		expect(result.service).toBe("stripe");
		expect(result.intentId).toBe("create_subscription");
		expect(result.params.customer).toBe("cus_123");
		expect(result.params.price).toBe("price_pro");
	});

	it("resolves OpenAI chat completion", async () => {
		const result = (await gate.do(
			"ask openai what is the meaning of life",
		)) as DryRunResult;
		expect(result.service).toBe("openai");
		expect(result.intentId).toBe("create_chat_completion");
	});

	it("resolves GitHub get user", async () => {
		const result = (await gate.do("get user torvalds")) as DryRunResult;
		expect(result.service).toBe("github");
		expect(result.intentId).toBe("get_user");
		expect(result.endpoint.url).toContain("torvalds");
	});

	it("resolves Stripe create customer", async () => {
		const result = (await gate.do(
			"create customer bob@test.com",
		)) as DryRunResult;
		expect(result.service).toBe("stripe");
		expect(result.intentId).toBe("create_customer");
		expect(result.params.email).toBe("bob@test.com");
	});
});

describe("cross-spec discovery", () => {
	const resolver = new LocalResolver(specs);

	it("discovers email capabilities from multiple providers", () => {
		const results = resolver.discover("send email");
		expect(results.length).toBeGreaterThan(0);
		// Resend should rank highest for email
		expect(results[0]?.service).toBe("resend");
	});

	it("discovers payment capabilities", () => {
		const results = resolver.discover("payment");
		expect(results.length).toBeGreaterThan(0);
		expect(results.some((r) => r.service === "stripe")).toBe(true);
	});

	it("discovers SMS capabilities", () => {
		const results = resolver.discover("send sms");
		expect(results.length).toBeGreaterThan(0);
		expect(results.some((r) => r.service === "twilio")).toBe(true);
	});

	it("discovers AI capabilities", () => {
		const results = resolver.discover("generate image");
		expect(results.length).toBeGreaterThan(0);
		expect(results.some((r) => r.service === "openai")).toBe(true);
	});

	it("discovers by service name", () => {
		const results = resolver.discover("stripe");
		expect(results.length).toBeGreaterThan(0);
		expect(results.every((r) => r.service === "stripe")).toBe(true);
	});

	it("returns results sorted by confidence", () => {
		const results = resolver.discover("create");
		for (let i = 1; i < results.length; i++) {
			expect(results[i]?.confidence).toBeLessThanOrEqual(
				results[i - 1]?.confidence,
			);
		}
	});
});
