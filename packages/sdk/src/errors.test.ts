import { describe, expect, it } from "vitest";
import {
	AgentGateError,
	AuthError,
	ExecutionError,
	ResolutionError,
	ValidationError,
} from "./errors.js";

describe("AgentGateError", () => {
	it("sets code and message", () => {
		const err = new AgentGateError("TEST_CODE", "test message");
		expect(err.code).toBe("TEST_CODE");
		expect(err.message).toBe("test message");
		expect(err.name).toBe("AgentGateError");
	});

	it("is an instance of Error", () => {
		const err = new AgentGateError("X", "y");
		expect(err).toBeInstanceOf(Error);
	});
});

describe("ResolutionError", () => {
	it("sets code and suggestions", () => {
		const err = new ResolutionError("not found", ["try X", "try Y"]);
		expect(err.code).toBe("RESOLUTION_FAILED");
		expect(err.name).toBe("ResolutionError");
		expect(err.suggestions).toEqual(["try X", "try Y"]);
		expect(err.message).toBe("not found");
	});

	it("defaults suggestions to empty array", () => {
		const err = new ResolutionError("not found");
		expect(err.suggestions).toEqual([]);
	});

	it("inherits from AgentGateError", () => {
		const err = new ResolutionError("x");
		expect(err).toBeInstanceOf(AgentGateError);
		expect(err).toBeInstanceOf(Error);
	});
});

describe("ValidationError", () => {
	it("sets param and message", () => {
		const err = new ValidationError("amount", "amount is required");
		expect(err.code).toBe("VALIDATION_FAILED");
		expect(err.name).toBe("ValidationError");
		expect(err.param).toBe("amount");
		expect(err.message).toBe("amount is required");
	});
});

describe("AuthError", () => {
	it("builds a helpful message from service and envVar", () => {
		const err = new AuthError("stripe", "STRIPE_KEY");
		expect(err.code).toBe("AUTH_MISSING");
		expect(err.name).toBe("AuthError");
		expect(err.service).toBe("stripe");
		expect(err.envVar).toBe("STRIPE_KEY");
		expect(err.message).toContain("stripe");
		expect(err.message).toContain("STRIPE_KEY");
	});
});

describe("ExecutionError", () => {
	it("sets status and response", () => {
		const body = { error: "bad request" };
		const err = new ExecutionError(400, body);
		expect(err.code).toBe("EXECUTION_FAILED");
		expect(err.name).toBe("ExecutionError");
		expect(err.status).toBe(400);
		expect(err.response).toEqual(body);
		expect(err.message).toContain("400");
	});

	it("accepts a custom message", () => {
		const err = new ExecutionError(500, null, "server exploded");
		expect(err.message).toBe("server exploded");
		expect(err.status).toBe(500);
		expect(err.response).toBeNull();
	});
});
