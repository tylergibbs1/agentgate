export interface AgentSpec {
	version: "1.0";
	service: ServiceInfo;
	auth: AuthConfig;
	intents: Intent[];
}

export interface ServiceInfo {
	name: string;
	description: string;
	baseUrl: string;
	contentType?: "application/json" | "application/x-www-form-urlencoded";
}

export interface AuthConfig {
	type: "api_key" | "bearer" | "oauth2";
	envVar: string;
	header?: string;
	prefix?: string;
	required?: boolean;
}

export interface IntentAuth {
	required?: boolean;
}

export interface Intent {
	id: string;
	description: string;
	patterns: string[];
	endpoint: EndpointConfig;
	params: IntentParam[];
	response: ResponseShape;
	flow?: FlowStep[];
	auth?: IntentAuth;
}

export interface EndpointConfig {
	method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
	path: string;
}

export interface IntentParam {
	name: string;
	type: "string" | "number" | "boolean" | "object";
	required: boolean;
	description: string;
	in: "body" | "path" | "query";
	default?: unknown;
	transform?: "cents";
	pattern?: string;
}

export interface ResponseShape {
	type: "object" | "array" | "string";
	description: string;
	properties?: Record<string, { type: string; description: string }>;
}

export interface FlowStep {
	intentId: string;
	description: string;
	mapParams?: Record<string, string>;
}
