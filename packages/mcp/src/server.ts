#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import type { AgentSpec } from "@grayhaven/agentgate-schema";
import { validateSpec } from "@grayhaven/agentgate-schema";
import { Gate } from "@grayhaven/agentgate";

function loadSpecs(): AgentSpec[] {
	const candidates = [
		resolve(process.cwd(), "specs"),
		resolve(import.meta.dirname, "..", "specs"),
		resolve(import.meta.dirname, "..", "..", "..", "specs"),
	];

	for (const dir of candidates) {
		try {
			const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
			if (files.length === 0) continue;
			const specs: AgentSpec[] = [];
			for (const file of files) {
				const data = JSON.parse(readFileSync(join(dir, file), "utf-8"));
				const result = validateSpec(data);
				if (result.valid && result.spec) specs.push(result.spec);
			}
			return specs;
		} catch {
			continue;
		}
	}
	return [];
}

const specs = loadSpecs();
const gate = new Gate({ specs });

const server = new McpServer({
	name: "agentgate",
	version: "0.1.0",
});

// Register a tool for each intent in each spec
for (const spec of specs) {
	for (const intent of spec.intents) {
		const toolName = `${spec.service.name}__${intent.id}`;

		// Build zod schema from intent params
		const schemaFields: Record<string, z.ZodTypeAny> = {};
		for (const param of intent.params) {
			let field: z.ZodTypeAny;
			switch (param.type) {
				case "number":
					field = z.number().describe(param.description);
					break;
				case "boolean":
					field = z.boolean().describe(param.description);
					break;
				default:
					field = z.string().describe(param.description);
			}
			if (!param.required) {
				field = field.optional();
			}
			schemaFields[param.name] = field;
		}

		const inputSchema = z.object(schemaFields);

		server.tool(
			toolName,
			`[${spec.service.name}] ${intent.description}. Patterns: ${intent.patterns.join(", ")}`,
			inputSchema.shape,
			async (params) => {
				try {
					// Build the natural language intent from params
					// Use the first pattern as a template, filling in param values
					let intentStr = intent.patterns[0]!;
					for (const [key, value] of Object.entries(params)) {
						intentStr = intentStr.replace(`{${key}}`, String(value));
					}

					const result = await gate.do(intentStr) as { data: unknown; service: string; intentId: string; response: { status: number } };
					return {
						content: [
							{
								type: "text" as const,
								text: JSON.stringify(result.data, null, 2),
							},
						],
					};
				} catch (err) {
					return {
						content: [
							{
								type: "text" as const,
								text: `Error: ${err instanceof Error ? err.message : String(err)}`,
							},
						],
						isError: true,
					};
				}
			},
		);
	}
}

// Also register meta-tools
server.tool(
	"agentgate__discover",
	"Search for API capabilities across all services. Returns matching intents ranked by relevance.",
	{ query: z.string().describe("Natural language search query") },
	async ({ query }) => {
		const results = await gate.discover(query);
		return {
			content: [
				{
					type: "text" as const,
					text: JSON.stringify(
						results.slice(0, 10).map((r) => ({
							tool: `${r.service}__${r.intentId}`,
							description: r.description,
							patterns: r.patterns,
							confidence: Math.round(r.confidence * 100) + "%",
						})),
						null,
						2,
					),
				},
			],
		};
	},
);

server.tool(
	"agentgate__do",
	"Execute any API call using natural language. Example: 'charge cus_123 $49.99' or 'send email to bob@test.com'. Use this when you know what you want to do but don't know the specific tool name.",
	{ intent: z.string().describe("Natural language intent, e.g. 'charge cus_123 $49.99'") },
	async ({ intent }) => {
		try {
			const result = await gate.do(intent) as { data: unknown; service: string; intentId: string; response: { status: number } };
			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(
							{
								service: result.service,
								intentId: result.intentId,
								data: result.data,
								status: result.response?.status,
							},
							null,
							2,
						),
					},
				],
			};
		} catch (err) {
			return {
				content: [
					{
						type: "text" as const,
						text: `Error: ${err instanceof Error ? err.message : String(err)}`,
					},
				],
				isError: true,
			};
		}
	},
);

server.tool(
	"agentgate__dry_run",
	"Preview what API call would be made without executing it. Shows the resolved service, endpoint, params, and confidence.",
	{ intent: z.string().describe("Natural language intent to preview") },
	async ({ intent }) => {
		const dryGate = new Gate({ specs, dryRun: true });
		try {
			const result = await dryGate.do(intent);
			return {
				content: [
					{
						type: "text" as const,
						text: JSON.stringify(result, null, 2),
					},
				],
			};
		} catch (err) {
			return {
				content: [
					{
						type: "text" as const,
						text: `Error: ${err instanceof Error ? err.message : String(err)}`,
					},
				],
				isError: true,
			};
		}
	},
);

// Start
const transport = new StdioServerTransport();
await server.connect(transport);
