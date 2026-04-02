import { validateSpec } from "@grayhaven/agentgate-schema";
import type {
	CrawlResult,
	CrawlTarget,
	CrawlerOptions,
	IndexEntry,
	SpecIndex,
} from "./types.js";

const DEFAULT_OPTIONS: Required<CrawlerOptions> = {
	concurrency: 3,
	delayMs: 500,
	timeoutMs: 10_000,
};

export class Crawler {
	private readonly options: Required<CrawlerOptions>;

	constructor(options?: CrawlerOptions) {
		this.options = { ...DEFAULT_OPTIONS, ...options };
	}

	async crawl(targets: CrawlTarget[]): Promise<CrawlResult[]> {
		const results: CrawlResult[] = [];
		const queue = [...targets];

		const workers = Array.from(
			{ length: Math.min(this.options.concurrency, queue.length) },
			async () => {
				while (queue.length > 0) {
					const target = queue.shift()!;
					const result = await this.crawlOne(target);
					results.push(result);
					if (queue.length > 0) {
						await sleep(this.options.delayMs);
					}
				}
			},
		);

		await Promise.all(workers);
		return results;
	}

	async crawlOne(target: CrawlTarget): Promise<CrawlResult> {
		const url =
			target.url ?? `https://${target.domain}/.well-known/agents.json`;
		const crawledAt = new Date().toISOString();

		try {
			const response = await fetch(url, {
				signal: AbortSignal.timeout(this.options.timeoutMs),
				headers: { Accept: "application/json" },
			});

			if (response.status === 404) {
				return { domain: target.domain, url, status: "not_found", crawledAt };
			}

			if (!response.ok) {
				return {
					domain: target.domain,
					url,
					status: "error",
					errors: [`HTTP ${response.status}`],
					crawledAt,
				};
			}

			const data: unknown = await response.json();
			const validation = validateSpec(data);

			if (!validation.valid) {
				return {
					domain: target.domain,
					url,
					status: "invalid",
					errors: validation.errors,
					crawledAt,
				};
			}

			return {
				domain: target.domain,
				url,
				status: "ok",
				spec: validation.spec!,
				crawledAt,
			};
		} catch (err) {
			return {
				domain: target.domain,
				url,
				status: "error",
				errors: [err instanceof Error ? err.message : String(err)],
				crawledAt,
			};
		}
	}

	buildIndex(results: CrawlResult[]): SpecIndex {
		const entries: IndexEntry[] = results
			.filter(
				(r): r is CrawlResult & { spec: NonNullable<CrawlResult["spec"]> } =>
					r.status === "ok" && r.spec !== undefined,
			)
			.map((r) => ({
				domain: r.domain,
				service: r.spec.service.name,
				description: r.spec.service.description,
				baseUrl: r.spec.service.baseUrl,
				intentCount: r.spec.intents.length,
				intents: r.spec.intents.map((i) => ({
					id: i.id,
					description: i.description,
					patterns: i.patterns,
				})),
				crawledAt: r.crawledAt,
				spec: r.spec,
			}));

		return {
			version: "1.0",
			updatedAt: new Date().toISOString(),
			entries,
		};
	}
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
