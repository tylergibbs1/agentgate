#!/usr/bin/env node

import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import type { AgentSpec } from "@agentgate/schema";
import { validateSpec } from "@agentgate/schema";
import { serve } from "@hono/node-server";
import { createApp } from "./app.js";

function loadSpecs(): AgentSpec[] {
	// Try index.json first, then fall back to specs/ directory
	const indexPath = process.env.AGENTGATE_INDEX_PATH;
	if (indexPath) {
		try {
			const raw = readFileSync(indexPath, "utf-8");
			const index = JSON.parse(raw) as { entries: Array<{ spec: AgentSpec }> };
			return index.entries.map((e) => e.spec);
		} catch (err) {
			console.error(`Failed to load index from ${indexPath}:`, err);
		}
	}

	// Fall back to specs/ directory
	const specsDir =
		process.env.AGENTGATE_SPECS_DIR ?? resolve(process.cwd(), "specs");
	try {
		const files = readdirSync(specsDir).filter((f) => f.endsWith(".json"));
		const specs: AgentSpec[] = [];
		for (const file of files) {
			const data = JSON.parse(readFileSync(join(specsDir, file), "utf-8"));
			const result = validateSpec(data);
			if (result.valid && result.spec) {
				specs.push(result.spec);
			} else {
				console.error(`Warning: ${file} failed validation`);
			}
		}
		return specs;
	} catch {
		console.error(`Could not read specs from ${specsDir}`);
		return [];
	}
}

const specs = loadSpecs();
const app = createApp(specs);
const port = Number.parseInt(process.env.PORT ?? "3100");

console.log("AgentGate Resolver API");
console.log(
	`  ${specs.length} services, ${specs.reduce((s, sp) => s + sp.intents.length, 0)} intents`,
);
console.log(`  Listening on http://localhost:${port}`);

serve({ fetch: app.fetch, port });
