import type { AgentSpec } from "@grayhaven/agentgate-schema";

export interface CrawlTarget {
	domain: string;
	url?: string;
}

export interface CrawlResult {
	domain: string;
	url: string;
	status: "ok" | "not_found" | "invalid" | "error";
	spec?: AgentSpec;
	errors?: string[];
	crawledAt: string;
}

export interface SpecIndex {
	version: "1.0";
	updatedAt: string;
	entries: IndexEntry[];
}

export interface IndexEntry {
	domain: string;
	service: string;
	description: string;
	baseUrl: string;
	intentCount: number;
	intents: Array<{ id: string; description: string; patterns: string[] }>;
	crawledAt: string;
	spec: AgentSpec;
}

export interface CrawlerOptions {
	concurrency?: number;
	delayMs?: number;
	timeoutMs?: number;
}
