import type { IntentParam } from "@grayhaven/agentgate-schema";
import { describe, expect, it } from "vitest";
import { compilePattern, matchPattern } from "./match.js";

const stringParam = (name: string, pattern?: string): IntentParam => ({
	name,
	type: "string",
	required: true,
	description: `The ${name}`,
	in: "body",
	pattern,
});

const numberParam = (name: string, transform?: "cents"): IntentParam => ({
	name,
	type: "number",
	required: true,
	description: `The ${name}`,
	in: "body",
	transform,
});

describe("compilePattern", () => {
	it("compiles a simple pattern", () => {
		const compiled = compilePattern("charge {customer} {amount}");
		expect(compiled.paramNames).toEqual(["customer", "amount"]);
		expect(compiled.tokenCount).toBe(1); // "charge"
	});

	it("compiles pattern with no params", () => {
		const compiled = compilePattern("list charges");
		expect(compiled.paramNames).toEqual([]);
		expect(compiled.tokenCount).toBe(2);
	});
});

describe("matchPattern", () => {
	it("matches exact pattern", () => {
		const compiled = compilePattern("charge {customer} {amount}");
		const params = [stringParam("customer"), numberParam("amount")];
		const result = matchPattern("charge cus_123 49.99", compiled, params);
		expect(result).not.toBeNull();
		expect(result?.params.customer).toBe("cus_123");
		expect(result?.params.amount).toBe(49.99);
		expect(result?.confidence).toBeGreaterThanOrEqual(1);
	});

	it("handles dollar sign in amount", () => {
		const compiled = compilePattern("charge {customer} {amount}");
		const params = [stringParam("customer"), numberParam("amount", "cents")];
		const result = matchPattern("charge cus_123 $49.99", compiled, params);
		expect(result).not.toBeNull();
		expect(result?.params.amount).toBe(4999);
	});

	it("returns null for non-matching input", () => {
		const compiled = compilePattern("charge {customer} {amount}");
		const params = [stringParam("customer"), numberParam("amount")];
		const result = matchPattern("send email to bob", compiled, params);
		expect(result).toBeNull();
	});

	it("matches case-insensitively", () => {
		const compiled = compilePattern("send email to {to}");
		const params = [stringParam("to")];
		const result = matchPattern(
			"Send Email To user@test.com",
			compiled,
			params,
		);
		expect(result).not.toBeNull();
		expect(result?.params.to).toBe("user@test.com");
	});

	it("validates param pattern", () => {
		const compiled = compilePattern("get customer {id}");
		const params = [stringParam("id", "^cus_")];
		const good = matchPattern("get customer cus_123", compiled, params);
		expect(good).not.toBeNull();
		expect(good?.params.id).toBe("cus_123");

		const bad = matchPattern("get customer 12345", compiled, params);
		// param won't match pattern, so it won't be extracted
		expect(bad).not.toBeNull();
		expect(bad?.params.id).toBeUndefined();
	});

	it("handles pattern with filler words between tokens", () => {
		const compiled = compilePattern("send {message} to {to}");
		const params = [stringParam("message"), stringParam("to")];
		const result = matchPattern("send hello to bob@test.com", compiled, params);
		expect(result).not.toBeNull();
		expect(result?.params.message).toBe("hello");
		expect(result?.params.to).toBe("bob@test.com");
	});

	it("handles euro and pound currency symbols", () => {
		const compiled = compilePattern("charge {amount}");
		const params = [numberParam("amount")];
		const euro = matchPattern("charge €50", compiled, params);
		expect(euro?.params.amount).toBe(50);
		const pound = matchPattern("charge £25.50", compiled, params);
		expect(pound?.params.amount).toBe(25.5);
	});

	it("handles comma-separated numbers", () => {
		const compiled = compilePattern("charge {amount}");
		const params = [numberParam("amount", "cents")];
		const result = matchPattern("charge $1,234.56", compiled, params);
		expect(result?.params.amount).toBe(123456);
	});

	it("returns undefined for non-numeric amount", () => {
		const compiled = compilePattern("charge {amount}");
		const params = [numberParam("amount")];
		const result = matchPattern("charge abc", compiled, params);
		expect(result).not.toBeNull();
		// param extraction fails, so it's not in params
		expect(result?.params.amount).toBeUndefined();
	});

	it("parses boolean params", () => {
		const boolParam = (name: string): IntentParam => ({
			name,
			type: "boolean",
			required: true,
			description: `The ${name}`,
			in: "body",
		});

		const compiled = compilePattern("set active {active}");
		const params = [boolParam("active")];

		expect(
			matchPattern("set active true", compiled, params)?.params.active,
		).toBe(true);
		expect(
			matchPattern("set active yes", compiled, params)?.params.active,
		).toBe(true);
		expect(matchPattern("set active 1", compiled, params)?.params.active).toBe(
			true,
		);
		expect(
			matchPattern("set active false", compiled, params)?.params.active,
		).toBe(false);
		expect(matchPattern("set active no", compiled, params)?.params.active).toBe(
			false,
		);
		expect(matchPattern("set active 0", compiled, params)?.params.active).toBe(
			false,
		);
	});

	it("returns undefined for invalid boolean value", () => {
		const boolParam: IntentParam = {
			name: "flag",
			type: "boolean",
			required: true,
			description: "flag",
			in: "body",
		};
		const compiled = compilePattern("set {flag}");
		const result = matchPattern("set maybe", compiled, [boolParam]);
		expect(result?.params.flag).toBeUndefined();
	});

	it("handles object type params as raw strings", () => {
		const objParam: IntentParam = {
			name: "data",
			type: "object",
			required: true,
			description: "data",
			in: "body",
		};
		const compiled = compilePattern("send {data}");
		const result = matchPattern("send payload123", compiled, [objParam]);
		expect(result?.params.data).toBe("payload123");
	});

	it("handles pattern with all params and no literals", () => {
		const compiled = compilePattern("{a} {b}");
		expect(compiled.tokenCount).toBe(0);
		expect(compiled.paramNames).toEqual(["a", "b"]);
		const result = matchPattern("hello world", compiled, [
			stringParam("a"),
			stringParam("b"),
		]);
		expect(result?.params.a).toBe("hello");
		expect(result?.params.b).toBe("world");
	});

	it("handles three consecutive params", () => {
		const compiled = compilePattern("set {a} {b} {c}");
		const result = matchPattern("set x y z", compiled, [
			stringParam("a"),
			stringParam("b"),
			stringParam("c"),
		]);
		expect(result?.params.a).toBe("x");
		expect(result?.params.b).toBe("y");
		expect(result?.params.c).toBe("z");
	});

	it("handles pattern with special regex characters in literals", () => {
		const compiled = compilePattern("price? {amount}");
		// The '?' should be escaped, not treated as regex quantifier
		const result = matchPattern("price? $10", compiled, [
			numberParam("amount"),
		]);
		expect(result).not.toBeNull();
		expect(result?.params.amount).toBe(10);
	});

	it("trims input whitespace", () => {
		const compiled = compilePattern("get {id}");
		const result = matchPattern("  get abc  ", compiled, [stringParam("id")]);
		expect(result?.params.id).toBe("abc");
	});

	it("confidence is reduced when param extraction fails", () => {
		const compiled = compilePattern("get {id}");
		const params = [stringParam("id", "^valid_")];
		const result = matchPattern("get invalid", compiled, params);
		expect(result).not.toBeNull();
		// literal "get" matches (1), but param fails (0) → 0.5 confidence
		expect(result?.confidence).toBeCloseTo(0.51, 1);
	});

	it("params not in paramDefs are stored as raw strings", () => {
		const compiled = compilePattern("do {thing}");
		// no paramDefs for "thing"
		const result = matchPattern("do something", compiled, []);
		expect(result?.params.thing).toBe("something");
	});
});
