/** Minimal OpenAPI 3.x types — just what we need for conversion */

export interface OpenAPISpec {
	openapi: string;
	info: {
		title: string;
		description?: string;
		version: string;
	};
	servers?: Array<{ url: string; description?: string }>;
	paths: Record<string, PathItem>;
	components?: {
		securitySchemes?: Record<string, SecurityScheme>;
		schemas?: Record<string, SchemaObject>;
	};
	security?: Array<Record<string, string[]>>;
}

export interface PathItem {
	get?: Operation;
	post?: Operation;
	put?: Operation;
	patch?: Operation;
	delete?: Operation;
	parameters?: Parameter[];
}

export interface Operation {
	operationId?: string;
	summary?: string;
	description?: string;
	parameters?: Parameter[];
	requestBody?: RequestBody;
	responses?: Record<string, ResponseObject>;
	tags?: string[];
	security?: Array<Record<string, string[]>>;
}

export interface Parameter {
	name: string;
	in: "query" | "header" | "path" | "cookie";
	description?: string;
	required?: boolean;
	schema?: SchemaObject;
}

export interface RequestBody {
	description?: string;
	required?: boolean;
	content?: Record<string, { schema?: SchemaObject }>;
}

export interface ResponseObject {
	description?: string;
	content?: Record<string, { schema?: SchemaObject }>;
}

export interface SecurityScheme {
	type: "apiKey" | "http" | "oauth2" | "openIdConnect";
	name?: string;
	in?: "query" | "header" | "cookie";
	scheme?: string;
	bearerFormat?: string;
}

export interface SchemaObject {
	type?: string;
	properties?: Record<string, SchemaObject>;
	items?: SchemaObject;
	description?: string;
	required?: string[];
	enum?: unknown[];
	format?: string;
	$ref?: string;
}

export interface ConvertOptions {
	/** Max intents to generate (default: 20) */
	maxIntents?: number;
	/** Service name override (default: derived from title) */
	serviceName?: string;
	/** Environment variable name for the API key */
	envVar?: string;
	/** Only include operations with these tags */
	tags?: string[];
	/** Only include these operation IDs */
	operationIds?: string[];
}
