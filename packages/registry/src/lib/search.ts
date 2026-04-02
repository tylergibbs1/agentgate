import type { ServiceSummary } from "./specs.js";

export interface SearchResult {
	service: string;
	intentId: string;
	description: string;
	patterns: string[];
	score: number;
}

export function searchIntents(
	query: string,
	services: ServiceSummary[],
): SearchResult[] {
	const words = query.toLowerCase().split(/\s+/).filter(Boolean);
	if (words.length === 0) return [];

	const results: SearchResult[] = [];

	for (const svc of services) {
		for (const intent of svc.intents) {
			const idWords = intent.id.toLowerCase().split(/[_-]/);
			const descWords = intent.description.toLowerCase().split(/\s+/);
			const patternWords = intent.patterns
				.join(" ")
				.toLowerCase()
				.replace(/[{}]/g, "")
				.split(/\s+/);

			let score = 0;
			for (const w of words) {
				if (idWords.includes(w) || patternWords.includes(w)) score += 1;
				else if (descWords.includes(w)) score += 0.7;
				else if (svc.name.toLowerCase().includes(w)) score += 0.5;
			}

			if (score > 0) {
				results.push({
					service: svc.name,
					intentId: intent.id,
					description: intent.description,
					patterns: intent.patterns,
					score: score / words.length,
				});
			}
		}
	}

	return results.sort((a, b) => b.score - a.score);
}
