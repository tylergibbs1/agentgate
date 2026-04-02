import type { AgentSpec } from "@grayhaven/agentgate-schema";
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

export interface FlowResult {
	steps: GateResult[];
	finalData: unknown;
}

export class Gate {
	private readonly specs: AgentSpec[];
	private readonly resolver: Resolver;
	private readonly executor: Executor;
	private readonly authProvider: AuthProvider;
	private readonly dryRun: boolean;
	private readonly logger: Logger;

	constructor(options: GateOptions) {
		this.specs = options.specs;
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

		const auth = resolved.authRequired
			? this.authProvider.getAuth(resolved.service)
			: null;
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

	/**
	 * Execute a multi-step flow by intent ID.
	 * Each step's output is mapped to the next step's params via mapParams.
	 */
	async doFlow(
		service: string,
		intentId: string,
		initialParams: Record<string, unknown>,
	): Promise<FlowResult> {
		const spec = this.specs.find((s) => s.service.name === service);
		if (!spec) throw new ResolutionError(`Unknown service: ${service}`);

		const intent = spec.intents.find((i) => i.id === intentId);
		if (!intent) throw new ResolutionError(`Unknown intent: ${intentId}`);
		if (!intent.flow || intent.flow.length === 0) {
			throw new ResolutionError(`Intent ${intentId} has no flow steps`);
		}

		const steps: GateResult[] = [];
		let prevData: Record<string, unknown> = {};

		// Execute the root intent first
		const rootResult = await this.doIntent(spec, intent, initialParams);
		steps.push(rootResult);
		prevData = (rootResult.data ?? {}) as Record<string, unknown>;

		// Execute each flow step
		for (const flowStep of intent.flow) {
			const stepIntent = spec.intents.find((i) => i.id === flowStep.intentId);
			if (!stepIntent) {
				throw new ResolutionError(
					`Flow step references unknown intent: ${flowStep.intentId}`,
				);
			}

			// Build params: start with initial, overlay mapped values from previous output
			const stepParams: Record<string, unknown> = { ...initialParams };
			if (flowStep.mapParams) {
				for (const [paramName, sourcePath] of Object.entries(
					flowStep.mapParams,
				)) {
					stepParams[paramName] = getNestedValue(prevData, sourcePath);
				}
			}

			const stepResult = await this.doIntent(spec, stepIntent, stepParams);
			steps.push(stepResult);
			prevData = (stepResult.data ?? {}) as Record<string, unknown>;
		}

		return { steps, finalData: prevData };
	}

	private async doIntent(
		spec: AgentSpec,
		intent: AgentSpec["intents"][number],
		params: Record<string, unknown>,
	): Promise<GateResult> {
		// Only include params that the intent defines
		let path = intent.endpoint.path;
		const bodyParams: Record<string, unknown> = {};

		for (const paramDef of intent.params) {
			if (paramDef.name in params) {
				bodyParams[paramDef.name] = params[paramDef.name];
			} else if (paramDef.default !== undefined) {
				bodyParams[paramDef.name] = paramDef.default;
			}
		}

		// Substitute path params and remove from body
		for (const paramDef of intent.params) {
			if (paramDef.in === "path" && paramDef.name in bodyParams) {
				path = path.replace(
					`{${paramDef.name}}`,
					String(bodyParams[paramDef.name]),
				);
				delete bodyParams[paramDef.name];
			}
		}

		const authRequired = intent.auth?.required ?? spec.auth.required ?? true;
		const resolved: ResolvedIntent = {
			service: spec.service.name,
			intentId: intent.id,
			description: intent.description,
			endpoint: {
				method: intent.endpoint.method,
				url: `${spec.service.baseUrl}${path}`,
			},
			params: bodyParams,
			confidence: 1,
			alternatives: [],
			authRequired,
			contentType: spec.service.contentType ?? "application/json",
		};

		const auth = resolved.authRequired
			? this.authProvider.getAuth(resolved.service)
			: null;
		const executeStart = performance.now();
		const result = await this.executor.execute(resolved, auth);
		const executedMs = Math.round(performance.now() - executeStart);

		this.logger.log({
			timestamp: new Date().toISOString(),
			type: "execution",
			service: resolved.service,
			intentId: resolved.intentId,
			input: `flow:${resolved.intentId}`,
			request: {
				method: resolved.endpoint.method,
				url: resolved.endpoint.url,
				body: resolved.params,
			},
			response: { status: result.status, durationMs: result.durationMs },
		});

		const reqBody =
			resolved.endpoint.method !== "GET" &&
			resolved.endpoint.method !== "DELETE"
				? resolved.params
				: undefined;

		return {
			service: resolved.service,
			intentId: resolved.intentId,
			description: resolved.description,
			data: result.data,
			request: {
				method: resolved.endpoint.method,
				url: resolved.endpoint.url,
				body: reqBody,
			},
			response: { status: result.status, headers: result.headers },
			timing: { resolvedMs: 0, executedMs },
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

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
	const parts = path.split(".");
	let current: unknown = obj;
	for (const part of parts) {
		if (current == null || typeof current !== "object") return undefined;
		current = (current as Record<string, unknown>)[part];
	}
	return current;
}
