import type { AgentSpec, Intent } from "@agentgate/schema";
import { compilePattern, matchPattern } from "./match.js";
import type { DiscoveryResult, ResolvedIntent, Resolver } from "./types.js";

const CONFIDENCE_THRESHOLD = 0.3;

interface IndexedIntent {
	spec: AgentSpec;
	intent: Intent;
	compiledPatterns: ReturnType<typeof compilePattern>[];
}

export class LocalResolver implements Resolver {
	private readonly index: IndexedIntent[] = [];

	constructor(specs: AgentSpec[]) {
		for (const spec of specs) {
			for (const intent of spec.intents) {
				this.index.push({
					spec,
					intent,
					compiledPatterns: intent.patterns.map(compilePattern),
				});
			}
		}
	}

	resolve(input: string): ResolvedIntent | null {
		const candidates: ResolvedIntent[] = [];

		for (const entry of this.index) {
			const best = this.matchIntent(input, entry);
			if (best && best.confidence >= CONFIDENCE_THRESHOLD) {
				candidates.push(best);
			}
		}

		if (candidates.length === 0) return null;

		// Sort by confidence descending
		candidates.sort((a, b) => b.confidence - a.confidence);

		const winner = candidates[0]!;
		winner.alternatives = candidates.slice(1);
		return winner;
	}

	discover(query: string): DiscoveryResult[] {
		const queryWords = query.toLowerCase().split(/\s+/);
		const results: DiscoveryResult[] = [];

		for (const entry of this.index) {
			const score = this.scoreDiscovery(queryWords, entry);
			if (score > 0) {
				results.push({
					service: entry.spec.service.name,
					intentId: entry.intent.id,
					description: entry.intent.description,
					patterns: entry.intent.patterns,
					confidence: score,
				});
			}
		}

		return results.sort((a, b) => b.confidence - a.confidence);
	}

	private matchIntent(
		input: string,
		entry: IndexedIntent,
	): ResolvedIntent | null {
		let bestMatch: {
			params: Record<string, unknown>;
			confidence: number;
		} | null = null;

		for (const compiled of entry.compiledPatterns) {
			const result = matchPattern(input, compiled, entry.intent.params);
			if (result && (!bestMatch || result.confidence > bestMatch.confidence)) {
				bestMatch = result;
			}
		}

		if (!bestMatch) return null;

		// Fill in defaults for missing required params
		for (const paramDef of entry.intent.params) {
			if (
				!(paramDef.name in bestMatch.params) &&
				paramDef.default !== undefined
			) {
				bestMatch.params[paramDef.name] = paramDef.default;
			}
		}

		// Build the full URL
		let path = entry.intent.endpoint.path;
		for (const paramDef of entry.intent.params) {
			if (paramDef.in === "path" && paramDef.name in bestMatch.params) {
				path = path.replace(
					`{${paramDef.name}}`,
					String(bestMatch.params[paramDef.name]),
				);
			}
		}

		return {
			service: entry.spec.service.name,
			intentId: entry.intent.id,
			description: entry.intent.description,
			endpoint: {
				method: entry.intent.endpoint.method,
				url: `${entry.spec.service.baseUrl}${path}`,
			},
			params: bestMatch.params,
			confidence: bestMatch.confidence,
			alternatives: [],
		};
	}

	private scoreDiscovery(queryWords: string[], entry: IndexedIntent): number {
		const descWords = entry.intent.description.toLowerCase().split(/\s+/);
		const patternWords = entry.intent.patterns
			.join(" ")
			.toLowerCase()
			.replace(/[{}]/g, "")
			.split(/\s+/);
		const serviceWords = entry.spec.service.name.toLowerCase().split(/[-_\s]+/);
		const idWords = entry.intent.id.toLowerCase().split(/[_-]/);

		// Require query words to be at least 2 characters for matching
		let score = 0;
		for (const qw of queryWords) {
			if (qw.length < 2) continue;

			const exactMatch =
				idWords.some((w) => w === qw) ||
				patternWords.some((w) => w === qw) ||
				serviceWords.some((w) => w === qw);
			const descMatch = descWords.some((w) => w === qw);
			const fuzzyMatch = [
				...idWords,
				...patternWords,
				...serviceWords,
				...descWords,
			].some(
				(w) =>
					(w.length >= 4 && w.includes(qw) && qw.length >= 3) ||
					(qw.length >= 4 && qw.includes(w) && w.length >= 3),
			);

			if (exactMatch) {
				score += 1;
			} else if (descMatch) {
				score += 0.7;
			} else if (fuzzyMatch) {
				score += 0.3;
			}
		}

		return queryWords.length > 0 ? score / queryWords.length : 0;
	}
}
