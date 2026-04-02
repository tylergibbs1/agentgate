import type { AgentSpec } from "@grayhaven/agentgate-schema";
import { LocalResolver } from "../resolver/local.js";

export function runDiscover(query: string, specs: AgentSpec[]): void {
	const resolver = new LocalResolver(specs);
	const results = resolver.discover(query);

	if (results.length === 0) {
		console.log(`No matching capabilities found for "${query}".`);
		return;
	}

	console.log(
		`\nFound ${results.length} matching ${results.length === 1 ? "capability" : "capabilities"} for "${query}":\n`,
	);

	const relevant = results.filter((r) => r.confidence >= 0.3);
	const shown =
		relevant.length > 0 ? relevant.slice(0, 10) : results.slice(0, 3);
	for (const result of shown) {
		const score = Math.round(result.confidence * 100);
		console.log(`  ${result.service} / ${result.intentId} (${score}% match)`);
		console.log(`    ${result.description}`);
		console.log(`    Patterns: ${result.patterns.join(", ")}`);
		console.log();
	}
}
