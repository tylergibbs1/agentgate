import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import type { AgentSpec } from "@agentgate/schema";
import { validateSpec } from "@agentgate/schema";

/**
 * Load all agents.json spec files from a directory.
 * Defaults to the specs/ directory at the repo root.
 */
export function loadSpecs(specsDir?: string): AgentSpec[] {
	const dir = specsDir ?? findSpecsDir();
	const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
	const specs: AgentSpec[] = [];

	for (const file of files) {
		const path = join(dir, file);
		const raw = readFileSync(path, "utf-8");
		let data: unknown;
		try {
			data = JSON.parse(raw);
		} catch {
			console.error(`Error: ${file} is not valid JSON`);
			continue;
		}
		const result = validateSpec(data);
		if (result.valid && result.spec) {
			specs.push(result.spec);
		} else {
			console.error(`Warning: ${file} failed validation:`);
			for (const err of result.errors) {
				console.error(`  ${err}`);
			}
		}
	}

	return specs;
}

function findSpecsDir(): string {
	// Walk up from the current file to find the specs directory
	// In the built CLI, this will be packages/sdk/dist/cli/util.js
	// The specs dir is at the repo root: ../../specs relative to packages/sdk
	const candidates = [
		resolve(process.cwd(), "specs"),
		resolve(import.meta.dirname ?? ".", "..", "..", "..", "..", "specs"),
	];

	for (const candidate of candidates) {
		try {
			readdirSync(candidate);
			return candidate;
		} catch {
			// Try next
		}
	}

	console.error(
		"Error: Could not find specs directory. Use --specs-dir to specify.",
	);
	process.exit(1);
}
