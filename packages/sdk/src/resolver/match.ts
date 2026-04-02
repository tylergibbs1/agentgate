import type { IntentParam } from "@grayhaven/agentgate-schema";

interface CompiledPattern {
	regex: RegExp;
	paramNames: string[];
	tokenCount: number;
}

/**
 * Compile a pattern string like "charge {customer} {amount}" into a regex
 * that extracts named parameters from natural language input.
 */
export function compilePattern(pattern: string): CompiledPattern {
	const paramNames: string[] = [];
	let tokenCount = 0;

	// Split pattern into tokens, tracking which are params
	const tokens = pattern.split(/\s+/);
	const regexParts: string[] = [];

	for (const token of tokens) {
		const paramMatch = token.match(/^\{(\w+)\}$/);
		if (paramMatch) {
			paramNames.push(paramMatch[1]!);
			// Capture group for the param — greedy single token by default
			regexParts.push("(\\S+)");
		} else {
			tokenCount++;
			// Literal token — case insensitive, allow optional filler words between
			regexParts.push(escapeRegex(token.toLowerCase()));
		}
	}

	// Join with flexible whitespace (allow extra words between tokens)
	const regexStr = regexParts.join("\\s+(?:\\S+\\s+)*?");
	const regex = new RegExp(regexStr, "i");

	return { regex, paramNames, tokenCount };
}

/**
 * Try to match input against a compiled pattern.
 * Returns extracted params and a confidence score, or null if no match.
 */
export function matchPattern(
	input: string,
	compiled: CompiledPattern,
	paramDefs: IntentParam[],
): { params: Record<string, unknown>; confidence: number } | null {
	const match = compiled.regex.exec(input.trim());
	if (!match) return null;

	const params: Record<string, unknown> = {};
	let paramScore = 0;

	for (let i = 0; i < compiled.paramNames.length; i++) {
		const name = compiled.paramNames[i]!;
		const raw = match[i + 1];
		if (!raw) continue;

		const def = paramDefs.find((p) => p.name === name);
		if (!def) {
			params[name] = raw;
			paramScore++;
			continue;
		}

		// Validate against pattern if defined
		if (def.pattern) {
			const paramRegex = new RegExp(def.pattern);
			if (!paramRegex.test(raw)) continue;
		}

		const parsed = parseParamValue(raw, def);
		if (parsed !== undefined) {
			params[name] = parsed;
			paramScore++;
		}
	}

	// Confidence: ratio of matched literal tokens + successfully parsed params
	const total = compiled.tokenCount + compiled.paramNames.length;
	const matched = compiled.tokenCount + paramScore;
	const confidence = total > 0 ? matched / total : 0;

	return { params, confidence };
}

function parseParamValue(raw: string, def: IntentParam): unknown {
	switch (def.type) {
		case "number": {
			// Strip currency symbols and commas
			const cleaned = raw.replace(/[$€£,]/g, "");
			const num = Number.parseFloat(cleaned);
			if (Number.isNaN(num) || !Number.isFinite(num)) return undefined;
			if (def.transform === "cents") {
				if (num < 0) return undefined;
				return Math.round(num * 100);
			}
			return num;
		}
		case "boolean":
			if (/^(true|yes|1)$/i.test(raw)) return true;
			if (/^(false|no|0)$/i.test(raw)) return false;
			return undefined;
		case "string":
			return raw;
		default:
			return raw;
	}
}

function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
