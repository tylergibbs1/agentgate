import type { AgentSpec } from "@agentgate/schema";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runDiscover } from "./discover.js";

const spec: AgentSpec = {
	version: "1.0",
	service: {
		name: "email-svc",
		description: "Email service",
		baseUrl: "https://api.email.com",
	},
	auth: { type: "bearer", envVar: "EMAIL_KEY" },
	intents: [
		{
			id: "send_email",
			description: "Send a transactional email",
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

describe("runDiscover", () => {
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

	it("prints matching capabilities", () => {
		runDiscover("send email", [spec]);
		const text = output.join("\n");
		expect(text).toContain("email-svc");
		expect(text).toContain("send_email");
		expect(text).toContain("Send a transactional email");
	});

	it("prints no match message when nothing found", () => {
		runDiscover("xyzzy", [spec]);
		const text = output.join("\n");
		expect(text).toContain("No matching capabilities");
	});

	it("shows confidence percentage", () => {
		runDiscover("email", [spec]);
		const text = output.join("\n");
		expect(text).toMatch(/\d+% match/);
	});

	it("shows patterns", () => {
		runDiscover("send email", [spec]);
		const text = output.join("\n");
		expect(text).toContain("send email to {to}");
	});
});
