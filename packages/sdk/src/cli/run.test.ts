import type { AgentSpec } from "@agentgate/schema";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runIntent } from "./run.js";

const spec: AgentSpec = {
	version: "1.0",
	service: {
		name: "test-svc",
		description: "Test service",
		baseUrl: "https://api.test.com",
	},
	auth: { type: "bearer", envVar: "TEST_KEY" },
	intents: [
		{
			id: "create_thing",
			description: "Create a thing",
			patterns: ["create thing {name}"],
			endpoint: { method: "POST", path: "/v1/things" },
			params: [
				{
					name: "name",
					type: "string",
					required: true,
					description: "Thing name",
					in: "body",
				},
			],
			response: { type: "object", description: "Created thing" },
		},
	],
};

describe("runIntent", () => {
	let output: string[];
	let errors: string[];
	let exitCode: number | undefined;

	beforeEach(() => {
		output = [];
		errors = [];
		exitCode = undefined;

		vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
			output.push(args.map(String).join(" "));
		});
		vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
			errors.push(args.map(String).join(" "));
		});
		vi.spyOn(process, "exit").mockImplementation(
			(code?: number | string | null | undefined) => {
				exitCode = typeof code === "number" ? code : 0;
				throw new Error(`process.exit(${code})`);
			},
		);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("prints dry run output", async () => {
		await runIntent("create thing my-widget", [spec], true);
		const text = output.join("\n");
		expect(text).toContain("Dry Run");
		expect(text).toContain("test-svc");
		expect(text).toContain("create_thing");
		expect(text).toContain("POST");
		expect(text).toContain("https://api.test.com/v1/things");
		expect(text).toContain("my-widget");
	});

	it("shows confidence percentage in dry run", async () => {
		await runIntent("create thing foo", [spec], true);
		const text = output.join("\n");
		expect(text).toMatch(/\d+%/);
	});

	it("prints resolution error with suggestions", async () => {
		await expect(runIntent("create something", [spec], true)).rejects.toThrow(
			"process.exit",
		);
		expect(exitCode).toBe(1);
		const text = errors.join("\n");
		expect(text).toContain("Could not resolve");
	});

	it("prints completely unresolvable error", async () => {
		await expect(runIntent("xyzzy plugh", [spec], true)).rejects.toThrow(
			"process.exit",
		);
		expect(exitCode).toBe(1);
	});
});
