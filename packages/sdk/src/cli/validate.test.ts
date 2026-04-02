import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runValidate } from "./validate.js";

describe("runValidate", () => {
	let output: string[];
	let errors: string[];
	let exitCode: number | undefined;
	let tmpDir: string;

	beforeEach(() => {
		output = [];
		errors = [];
		exitCode = undefined;
		tmpDir = mkdtempSync(join(tmpdir(), "agentgate-test-"));

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

	it("validates a valid spec file", () => {
		const validSpec = {
			version: "1.0",
			service: {
				name: "test",
				description: "Test service",
				baseUrl: "https://api.test.com",
			},
			auth: { type: "bearer", envVar: "KEY" },
			intents: [
				{
					id: "test",
					description: "Test",
					patterns: ["test {x}"],
					endpoint: { method: "GET", path: "/test" },
					params: [
						{
							name: "x",
							type: "string",
							required: true,
							description: "x",
							in: "query",
						},
					],
					response: { type: "object", description: "Result" },
				},
			],
		};
		const file = join(tmpDir, "valid.json");
		writeFileSync(file, JSON.stringify(validSpec));

		runValidate(file);
		const text = output.join("\n");
		expect(text).toContain("✓ Valid");
		expect(text).toContain("test");
		expect(text).toContain("1");
	});

	it("rejects invalid spec with errors", () => {
		const file = join(tmpDir, "invalid.json");
		writeFileSync(file, JSON.stringify({ version: "2.0" }));

		expect(() => runValidate(file)).toThrow("process.exit");
		expect(exitCode).toBe(1);
		const text = errors.join("\n");
		expect(text).toContain("✗ Invalid");
	});

	it("rejects invalid JSON", () => {
		const file = join(tmpDir, "bad.json");
		writeFileSync(file, "not json{{{");

		expect(() => runValidate(file)).toThrow("process.exit");
		expect(exitCode).toBe(1);
		expect(errors.join("\n")).toContain("not valid JSON");
	});

	it("handles missing file", () => {
		expect(() => runValidate("/nonexistent/file.json")).toThrow("process.exit");
		expect(exitCode).toBe(1);
		expect(errors.join("\n")).toContain("Could not read");
	});
});
