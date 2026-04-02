import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { AgentSpec } from "@grayhaven/agentgate-schema";
import type { IntentParam } from "@grayhaven/agentgate-schema";
import { describe, expect, it } from "vitest";
import { LocalResolver } from "./local.js";
import { compilePattern, matchPattern } from "./match.js";

const specsDir = join(import.meta.dirname, "..", "..", "..", "..", "specs");
const specs: AgentSpec[] = readdirSync(specsDir)
	.filter((f) => f.endsWith(".json"))
	.map(
		(f) => JSON.parse(readFileSync(join(specsDir, f), "utf-8")) as AgentSpec,
	);

const resolver = new LocalResolver(specs);

const centsParam: IntentParam = {
	name: "amount",
	type: "number",
	required: true,
	description: "Amount",
	in: "body",
	transform: "cents",
};

const cusParam: IntentParam = {
	name: "customer",
	type: "string",
	required: true,
	description: "Customer ID",
	in: "body",
	pattern: "^cus_",
};

describe("number parsing edge cases", () => {
	const compiled = compilePattern("charge {customer} {amount}");
	const params = [cusParam, centsParam];

	it("rejects Infinity", () => {
		const result = matchPattern("charge cus_1 $Infinity", compiled, params);
		expect(result?.params.amount).toBeUndefined();
	});

	it("rejects NaN", () => {
		const result = matchPattern("charge cus_1 $NaN", compiled, params);
		expect(result?.params.amount).toBeUndefined();
	});

	it("rejects negative amounts for cents transform", () => {
		const result = matchPattern("charge cus_1 $-50", compiled, params);
		expect(result?.params.amount).toBeUndefined();
	});

	it("accepts zero", () => {
		const result = matchPattern("charge cus_1 $0", compiled, params);
		expect(result?.params.amount).toBe(0);
	});

	it("handles sub-cent correctly (rounds to 0)", () => {
		const result = matchPattern("charge cus_1 $0.001", compiled, params);
		expect(result?.params.amount).toBe(0);
	});

	it("handles large amounts", () => {
		const result = matchPattern("charge cus_1 $999999", compiled, params);
		expect(result?.params.amount).toBe(99999900);
	});

	it("allows negative numbers without cents transform", () => {
		const numParam: IntentParam = {
			name: "offset",
			type: "number",
			required: true,
			description: "Offset",
			in: "query",
		};
		const compiled2 = compilePattern("offset {offset}");
		const result = matchPattern("offset -10", compiled2, [numParam]);
		expect(result?.params.offset).toBe(-10);
	});
});

describe("discovery scoring edge cases", () => {
	it("returns empty for single character query", () => {
		const results = resolver.discover("s");
		expect(results).toEqual([]);
	});

	it("returns empty for complete gibberish", () => {
		const results = resolver.discover("xyzzy plugh abraca");
		expect(results).toEqual([]);
	});

	it("still finds exact matches for short words", () => {
		// "sms" is 3 chars but exact match in twilio patterns
		const results = resolver.discover("sms");
		expect(results.length).toBeGreaterThan(0);
		expect(results[0]?.service).toBe("twilio");
	});

	it("finds 'send email' with high confidence", () => {
		const results = resolver.discover("send email");
		expect(results.length).toBeGreaterThan(0);
		const emailProviders = ["resend", "postmark", "sendgrid"];
		expect(emailProviders).toContain(results[0]?.service);
		expect(results[0]?.confidence).toBeGreaterThan(0.5);
	});
});

describe("adversarial input handling", () => {
	it("returns null for empty string", () => {
		expect(resolver.resolve("")).toBeNull();
	});

	it("returns null for whitespace only", () => {
		expect(resolver.resolve("   ")).toBeNull();
	});

	it("handles XSS payloads without crashing", () => {
		const result = resolver.resolve("charge <script>alert(1)</script> $50");
		// Should match charge pattern but customer param fails ^cus_ validation
		if (result) {
			expect(result.service).toBe("stripe");
			// Customer should NOT be extracted since it doesn't match ^cus_
			expect(result.params.customer).toBeUndefined();
		}
	});

	it("handles SQL injection without crashing", () => {
		const result = resolver.resolve("charge cus_123 $50; DROP TABLE users;");
		// Should still parse — the semicolon is just noise after the valid intent
		expect(result).not.toBeNull();
		expect(result?.service).toBe("stripe");
	});

	it("handles very long input without hanging", () => {
		const start = performance.now();
		resolver.resolve(`charge ${"a".repeat(10000)} $50`);
		const elapsed = performance.now() - start;
		expect(elapsed).toBeLessThan(1000); // should be fast
	});

	it("handles ALL CAPS", () => {
		const result = resolver.resolve("CHARGE CUS_123 $50");
		// Pattern matching is case insensitive for literals but params are raw
		// CUS_123 won't match ^cus_ (case sensitive pattern)
		if (result) {
			expect(result.service).toBe("stripe");
		}
	});
});

describe("cross-spec disambiguation", () => {
	it("'send message to bob' resolves to twilio, not resend", () => {
		const result = resolver.resolve("send message to bob");
		// "send message to {to}" matches twilio/send_sms pattern
		expect(result).not.toBeNull();
		expect(result?.service).toBe("twilio");
	});

	it("'email bob@test.com' resolves to resend", () => {
		const result = resolver.resolve("email bob@test.com");
		expect(result).not.toBeNull();
		expect(result?.service).toBe("resend");
	});

	it("'get balance' resolves to stripe, not others", () => {
		const result = resolver.resolve("get balance");
		expect(result).not.toBeNull();
		expect(result?.service).toBe("stripe");
		expect(result?.intentId).toBe("get_balance");
	});

	it("'list repos for octocat' resolves to github", () => {
		const result = resolver.resolve("list repos for octocat");
		expect(result).not.toBeNull();
		expect(result?.service).toBe("github");
	});

	it("'generate image sunset' resolves to openai", () => {
		const result = resolver.resolve("generate image sunset");
		expect(result).not.toBeNull();
		expect(result?.service).toBe("openai");
		expect(result?.intentId).toBe("create_image");
	});
});
