import type { IntentParam } from "@grayhaven/agentgate-schema";

interface CompiledPattern {
	strictRegex: RegExp;
	looseRegex: RegExp;
	paramNames: string[];
	tokenCount: number;
	totalTokens: number;
}

/**
 * Compile a pattern string like "charge {customer} {amount}" into regexes
 * that extract named parameters from natural language input.
 * Two regexes: strict (exact token order, no fillers) and loose (allows fillers).
 */
export function compilePattern(pattern: string): CompiledPattern {
	const paramNames: string[] = [];
	let tokenCount = 0;

	const tokens = pattern.split(/\s+/);
	const strictParts: string[] = [];
	const looseParts: string[] = [];

	for (const token of tokens) {
		const paramMatch = token.match(/^\{(\w+)\}$/);
		if (paramMatch) {
			paramNames.push(paramMatch[1]!);
			strictParts.push("(\\S+)");
			looseParts.push("(\\S+)");
		} else {
			tokenCount++;
			const escaped = escapeRegex(token.toLowerCase());
			strictParts.push(escaped);
			looseParts.push(escaped);
		}
	}

	const strictRegex = new RegExp(strictParts.join("\\s+"), "i");
	const looseRegex = new RegExp(
		looseParts.join("\\s+(?:\\S+\\s+)*?"),
		"i",
	);

	return {
		strictRegex,
		looseRegex,
		paramNames,
		tokenCount,
		totalTokens: tokens.length,
	};
}

/**
 * Try to match input against a compiled pattern.
 * Strict matches (no filler words needed) get full confidence.
 * Loose matches (filler words absorbed) get penalized confidence.
 */
export function matchPattern(
	input: string,
	compiled: CompiledPattern,
	paramDefs: IntentParam[],
): { params: Record<string, unknown>; confidence: number } | null {
	const trimmed = input.trim();

	// Try strict match first — higher confidence
	const strictMatch = compiled.strictRegex.exec(trimmed);
	if (strictMatch) {
		const result = extractParams(
			strictMatch,
			compiled.paramNames,
			paramDefs,
		);
		if (result) {
			const total = compiled.tokenCount + compiled.paramNames.length;
			const matched = compiled.tokenCount + result.paramScore;
			const baseConfidence = total > 0 ? matched / total : 0;
			// Tiny specificity bonus: more literal tokens = slightly higher score
			// This breaks ties between "email {to}" (1 literal) and "get email {id}" (2 literals)
			const specificityBonus = compiled.tokenCount * 0.01;
			result.confidence = baseConfidence + specificityBonus;
			return result;
		}
	}

	// Fall back to loose match — penalized confidence
	const looseMatch = compiled.looseRegex.exec(trimmed);
	if (looseMatch) {
		const result = extractParams(
			looseMatch,
			compiled.paramNames,
			paramDefs,
		);
		if (result) {
			const total = compiled.tokenCount + compiled.paramNames.length;
			const matched = compiled.tokenCount + result.paramScore;
			const baseConfidence = total > 0 ? matched / total : 0;

			// Penalize: how many extra words did the input have vs the pattern?
			const inputWordCount = trimmed.split(/\s+/).length;
			const patternWordCount = compiled.totalTokens;
			const extraWords = Math.max(0, inputWordCount - patternWordCount);
			const penalty = extraWords * 0.1;

			result.confidence = Math.max(0, baseConfidence - penalty);
			return result;
		}
	}

	return null;
}

function extractParams(
	match: RegExpExecArray,
	paramNames: string[],
	paramDefs: IntentParam[],
): { params: Record<string, unknown>; confidence: number; paramScore: number } | null {
	const params: Record<string, unknown> = {};
	let paramScore = 0;

	for (let i = 0; i < paramNames.length; i++) {
		const name = paramNames[i]!;
		const raw = match[i + 1];
		if (!raw) continue;

		const def = paramDefs.find((p) => p.name === name);
		if (!def) {
			params[name] = raw;
			paramScore++;
			continue;
		}

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

	return { params, confidence: 0, paramScore };
}

function parseParamValue(raw: string, def: IntentParam): unknown {
	switch (def.type) {
		case "number": {
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
