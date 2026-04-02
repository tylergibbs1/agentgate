import type { DiscoveryResult, ResolvedIntent, Resolver } from "./types.js";

export class HttpResolver implements Resolver {
	constructor(private readonly baseUrl: string) {}

	async resolve(input: string): Promise<ResolvedIntent | null> {
		const response = await fetch(`${this.baseUrl}/resolve`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ intent: input }),
		});

		if (response.status === 404) return null;
		if (!response.ok) return null;

		return (await response.json()) as ResolvedIntent;
	}

	async discover(query: string): Promise<DiscoveryResult[]> {
		const params = new URLSearchParams({ q: query });
		const response = await fetch(`${this.baseUrl}/discover?${params}`);

		if (!response.ok) return [];

		const data = (await response.json()) as { results: DiscoveryResult[] };
		return data.results;
	}
}
