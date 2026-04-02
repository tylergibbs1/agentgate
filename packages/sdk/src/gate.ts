import type { AgentSpec } from "@agentgate/schema";
import { EnvAuthProvider } from "./auth/env.js";
import type { AuthProvider } from "./auth/types.js";
import { ResolutionError, ValidationError } from "./errors.js";
import { HttpExecutor } from "./executor/http.js";
import type { Executor } from "./executor/types.js";
import { MemoryLogger } from "./logger.js";
import type { LogEntry, Logger } from "./logger.js";
import { LocalResolver } from "./resolver/local.js";
import type {
	DiscoveryResult,
	ResolvedIntent,
	Resolver,
} from "./resolver/types.js";

export interface GateOptions {
	specs: AgentSpec[];
	keys?: Record<string, string>;
	dryRun?: boolean;
	logger?: Logger;
	resolver?: Resolver;
	executor?: Executor;
	auth?: AuthProvider;
}

export interface GateResult {
	service: string;
	intentId: string;
	description: string;
	data: unknown;
	request: { method: string; url: string; body?: Record<string, unknown> };
	response: { status: number; headers: Record<string, string> };
	timing: { resolvedMs: number; executedMs: number };
}

export interface DryRunResult {
	service: string;
	intentId: string;
	description: string;
	endpoint: { method: string; url: string };
	params: Record<string, unknown>;
	confidence: number;
	alternatives: Array<{
		service: string;
		intentId: string;
		description: string;
		confidence: number;
	}>;
}

export class Gate {
	private readonly resolver: Resolver;
	private readonly executor: Executor;
	private readonly authProvider: AuthProvider;
	private readonly dryRun: boolean;
	private readonly logger: Logger;

	constructor(options: GateOptions) {
		this.resolver = options.resolver ?? new LocalResolver(options.specs);
		this.executor = options.executor ?? new HttpExecutor();
		this.authProvider =
			options.auth ?? new EnvAuthProvider(options.specs, options.keys);
		this.dryRun = options.dryRun ?? false;
		this.logger = options.logger ?? new MemoryLogger();
	}

	async do(intent: string): Promise<GateResult | DryRunResult> {
		const resolveStart = performance.now();
		const resolved = await this.resolver.resolve(intent);
		const resolvedMs = Math.round(performance.now() - resolveStart);

		if (!resolved) {
			// Try to find suggestions
			const discovered = await this.resolver.discover(intent);
			const suggestions = discovered
				.slice(0, 3)
				.map((d) => `${d.service}: ${d.intentId} — ${d.description}`);

			throw new ResolutionError(
				`Could not resolve intent: "${intent}"`,
				suggestions,
			);
		}

		// Validate required params
		this.validateParams(resolved);

		if (this.dryRun) {
			this.logger.log({
				timestamp: new Date().toISOString(),
				type: "resolution",
				service: resolved.service,
				intentId: resolved.intentId,
				input: intent,
				request: {
					method: resolved.endpoint.method,
					url: resolved.endpoint.url,
					body: resolved.params,
				},
			});

			return {
				service: resolved.service,
				intentId: resolved.intentId,
				description: resolved.description,
				endpoint: resolved.endpoint,
				params: resolved.params,
				confidence: resolved.confidence,
				alternatives: resolved.alternatives.map((a) => ({
					service: a.service,
					intentId: a.intentId,
					description: a.description,
					confidence: a.confidence,
				})),
			};
		}

		const auth = this.authProvider.getAuth(resolved.service);
		const executeStart = performance.now();
		const result = await this.executor.execute(resolved, auth);
		const executedMs = Math.round(performance.now() - executeStart);

		const bodyParams =
			resolved.endpoint.method !== "GET" &&
			resolved.endpoint.method !== "DELETE"
				? (resolved.params as Record<string, unknown>)
				: undefined;

		this.logger.log({
			timestamp: new Date().toISOString(),
			type: "execution",
			service: resolved.service,
			intentId: resolved.intentId,
			input: intent,
			request: {
				method: resolved.endpoint.method,
				url: resolved.endpoint.url,
				body: bodyParams,
			},
			response: {
				status: result.status,
				durationMs: result.durationMs,
			},
		});

		return {
			service: resolved.service,
			intentId: resolved.intentId,
			description: resolved.description,
			data: result.data,
			request: {
				method: resolved.endpoint.method,
				url: resolved.endpoint.url,
				body: bodyParams,
			},
			response: {
				status: result.status,
				headers: result.headers,
			},
			timing: {
				resolvedMs,
				executedMs,
			},
		};
	}

	async discover(query: string): Promise<DiscoveryResult[]> {
		return this.resolver.discover(query);
	}

	get logs(): readonly LogEntry[] {
		return this.logger.entries();
	}

	private validateParams(resolved: ResolvedIntent): void {
		for (const [key, value] of Object.entries(resolved.params)) {
			if (value === undefined) {
				throw new ValidationError(
					key,
					`Parameter "${key}" is required but could not be extracted from the intent.`,
				);
			}
		}
	}
}
