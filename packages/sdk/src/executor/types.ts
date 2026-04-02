import type { AuthHeader } from "../auth/types.js";
import type { ResolvedIntent } from "../resolver/types.js";

export interface ExecutionResult {
	data: unknown;
	status: number;
	headers: Record<string, string>;
	durationMs: number;
}

export interface Executor {
	execute(resolved: ResolvedIntent, auth: AuthHeader | null): Promise<ExecutionResult>;
}
