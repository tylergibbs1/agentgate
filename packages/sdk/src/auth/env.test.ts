import type { AgentSpec } from "@agentgate/schema";
import { afterEach, describe, expect, it } from "vitest";
import { AuthError } from "../errors.js";
import { EnvAuthProvider } from "./env.js";

const makeSpec = (overrides?: Partial<AgentSpec["auth"]>): AgentSpec => ({
	version: "1.0",
	service: {
		name: "test-svc",
		description: "Test",
		baseUrl: "https://api.test.com",
	},
	auth: {
		type: "bearer",
		envVar: "TEST_API_KEY",
		...overrides,
	},
	intents: [],
});

describe("EnvAuthProvider", () => {
	afterEach(() => {
		// biome-ignore lint/performance/noDelete: must fully remove env vars
		delete process.env.TEST_API_KEY;
		// biome-ignore lint/performance/noDelete: must fully remove env vars
		delete process.env.OTHER_KEY;
	});

	it("reads key from explicit keys by service name", () => {
		const provider = new EnvAuthProvider([makeSpec()], {
			"test-svc": "sk_explicit",
		});
		const auth = provider.getAuth("test-svc");
		expect(auth.value).toBe("Bearer sk_explicit");
	});

	it("reads key from explicit keys by envVar name", () => {
		const provider = new EnvAuthProvider([makeSpec()], {
			TEST_API_KEY: "sk_by_env",
		});
		const auth = provider.getAuth("test-svc");
		expect(auth.value).toBe("Bearer sk_by_env");
	});

	it("falls back to process.env", () => {
		process.env.TEST_API_KEY = "sk_from_env";
		const provider = new EnvAuthProvider([makeSpec()]);
		const auth = provider.getAuth("test-svc");
		expect(auth.value).toBe("Bearer sk_from_env");
	});

	it("prefers explicit service key over envVar key over process.env", () => {
		process.env.TEST_API_KEY = "sk_env";
		const provider = new EnvAuthProvider([makeSpec()], {
			"test-svc": "sk_service",
			TEST_API_KEY: "sk_envvar",
		});
		const auth = provider.getAuth("test-svc");
		expect(auth.value).toBe("Bearer sk_service");
	});

	it("throws AuthError when no key found", () => {
		const provider = new EnvAuthProvider([makeSpec()]);
		expect(() => provider.getAuth("test-svc")).toThrow(AuthError);
		try {
			provider.getAuth("test-svc");
		} catch (e) {
			const err = e as AuthError;
			expect(err.service).toBe("test-svc");
			expect(err.envVar).toBe("TEST_API_KEY");
		}
	});

	it("throws AuthError for unknown service", () => {
		const provider = new EnvAuthProvider([makeSpec()]);
		expect(() => provider.getAuth("unknown")).toThrow(AuthError);
	});

	it("uses custom header name", () => {
		const provider = new EnvAuthProvider([makeSpec({ header: "X-Api-Key" })], {
			"test-svc": "mykey",
		});
		const auth = provider.getAuth("test-svc");
		expect(auth.name).toBe("X-Api-Key");
	});

	it("uses custom prefix", () => {
		const provider = new EnvAuthProvider([makeSpec({ prefix: "Token" })], {
			"test-svc": "abc123",
		});
		const auth = provider.getAuth("test-svc");
		expect(auth.value).toBe("Token abc123");
	});

	it("uses no prefix for api_key type without explicit prefix", () => {
		const provider = new EnvAuthProvider(
			[makeSpec({ type: "api_key", prefix: undefined })],
			{ "test-svc": "raw_key" },
		);
		const auth = provider.getAuth("test-svc");
		expect(auth.value).toBe("raw_key");
	});

	it("defaults to Bearer prefix for bearer type", () => {
		const provider = new EnvAuthProvider([makeSpec({ type: "bearer" })], {
			"test-svc": "tok",
		});
		const auth = provider.getAuth("test-svc");
		expect(auth.value).toBe("Bearer tok");
	});

	it("handles multiple services", () => {
		const specA = makeSpec();
		const specB: AgentSpec = {
			...makeSpec({ envVar: "OTHER_KEY" }),
			service: {
				name: "other-svc",
				description: "Other",
				baseUrl: "https://other.com",
			},
		};
		const provider = new EnvAuthProvider([specA, specB], {
			"test-svc": "key_a",
			"other-svc": "key_b",
		});
		expect(provider.getAuth("test-svc").value).toBe("Bearer key_a");
		expect(provider.getAuth("other-svc").value).toBe("Bearer key_b");
	});
});
