import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import type { AgentSpec } from "@agentgate/schema";
import { validateSpec } from "@agentgate/schema";

/**
 * Load all agents.json spec files from a directory.
 * Searches: explicit path → ./specs → bundled specs inside the package.
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
	const candidates = [
		// 1. ./specs in current working directory
		resolve(process.cwd(), "specs"),
		// 2. Bundled specs inside the npm package (dist/cli/util.js → ../../specs)
		resolve(import.meta.dirname ?? ".", "..", "..", "specs"),
		// 3. Monorepo root specs (dev mode)
		resolve(import.meta.dirname ?? ".", "..", "..", "..", "..", "specs"),
	];

	for (const candidate of candidates) {
		try {
			const files = readdirSync(candidate);
			if (files.some((f) => f.endsWith(".json"))) {
				return candidate;
			}
		} catch {
			// Try next
		}
	}

	console.error(
		"Error: Could not find specs directory. Use --specs-dir to specify.",
	);
	process.exit(1);
}
