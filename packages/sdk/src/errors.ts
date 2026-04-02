export class AgentGateError extends Error {
	readonly code: string;

	constructor(code: string, message: string) {
		super(message);
		this.name = "AgentGateError";
		this.code = code;
	}
}

export class ResolutionError extends AgentGateError {
	readonly suggestions: string[];

	constructor(message: string, suggestions: string[] = []) {
		super("RESOLUTION_FAILED", message);
		this.name = "ResolutionError";
		this.suggestions = suggestions;
	}
}

export class ValidationError extends AgentGateError {
	readonly param: string;

	constructor(param: string, message: string) {
		super("VALIDATION_FAILED", message);
		this.name = "ValidationError";
		this.param = param;
	}
}

export class AuthError extends AgentGateError {
	readonly service: string;
	readonly envVar: string;

	constructor(service: string, envVar: string) {
		super(
			"AUTH_MISSING",
			`Missing API key for ${service}. Set the ${envVar} environment variable or pass it in the keys option.`,
		);
		this.name = "AuthError";
		this.service = service;
		this.envVar = envVar;
	}
}

export class ExecutionError extends AgentGateError {
	readonly status: number;
	readonly response: unknown;

	constructor(status: number, response: unknown, message?: string) {
		super(
			"EXECUTION_FAILED",
			message ?? `API call failed with status ${status}`,
		);
		this.name = "ExecutionError";
		this.status = status;
		this.response = response;
	}
}
