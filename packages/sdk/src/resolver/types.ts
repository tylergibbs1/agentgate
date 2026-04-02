export interface ResolvedIntent {
	service: string;
	intentId: string;
	description: string;
	endpoint: { method: string; url: string };
	params: Record<string, unknown>;
	confidence: number;
	alternatives: ResolvedIntent[];
}

export interface DiscoveryResult {
	service: string;
	intentId: string;
	description: string;
	patterns: string[];
	confidence: number;
}

export interface Resolver {
	resolve(
		input: string,
	): ResolvedIntent | null | Promise<ResolvedIntent | null>;
	discover(query: string): DiscoveryResult[] | Promise<DiscoveryResult[]>;
}
