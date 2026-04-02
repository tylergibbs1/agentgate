import type { AgentSpec } from "@agentgate/schema";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runList } from "./list.js";

const specA: AgentSpec = {
	version: "1.0",
	service: {
		name: "alpha",
		description: "Alpha service",
		baseUrl: "https://api.alpha.com",
	},
	auth: { type: "bearer", envVar: "ALPHA_KEY" },
	intents: [
		{
			id: "do_alpha",
			description: "Do alpha thing",
			patterns: ["alpha {x}"],
			endpoint: { method: "POST", path: "/alpha" },
			params: [
				{
					name: "x",
					type: "string",
					required: true,
					description: "X",
					in: "body",
				},
			],
			response: { type: "object", description: "Alpha result" },
		},
	],
};

const specB: AgentSpec = {
	version: "1.0",
	service: {
		name: "beta",
		description: "Beta service",
		baseUrl: "https://api.beta.com",
	},
	auth: { type: "api_key", envVar: "BETA_KEY" },
	intents: [
		{
			id: "do_beta_1",
			description: "Do beta one",
			patterns: ["beta one"],
			endpoint: { method: "GET", path: "/beta/1" },
			params: [],
			response: { type: "object", description: "Beta 1" },
		},
		{
			id: "do_beta_2",
			description: "Do beta two",
			patterns: ["beta two"],
			endpoint: { method: "GET", path: "/beta/2" },
			params: [],
			response: { type: "object", description: "Beta 2" },
		},
	],
};

describe("runList", () => {
	let output: string[];

	beforeEach(() => {
		output = [];
		vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
			output.push(args.map(String).join(" "));
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("prints all services and intents", () => {
		runList([specA, specB]);
		const text = output.join("\n");
		expect(text).toContain("2 services, 3 intents");
		expect(text).toContain("alpha");
		expect(text).toContain("beta");
		expect(text).toContain("do_alpha");
		expect(text).toContain("do_beta_1");
		expect(text).toContain("do_beta_2");
	});

	it("shows auth info", () => {
		runList([specA]);
		const text = output.join("\n");
		expect(text).toContain("bearer via ALPHA_KEY");
	});

	it("shows base URL", () => {
		runList([specA]);
		const text = output.join("\n");
		expect(text).toContain("https://api.alpha.com");
	});

	it("handles empty specs", () => {
		runList([]);
		const text = output.join("\n");
		expect(text).toContain("No specs loaded");
	});

	it("shows single service correctly", () => {
		runList([specA]);
		const text = output.join("\n");
		expect(text).toContain("1 service, 1 intent");
	});
});
