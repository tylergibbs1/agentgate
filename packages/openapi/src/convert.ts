import type { AgentSpec, Intent, IntentParam } from "@grayhaven/agentgate-schema";
import type {
	ConvertOptions,
	OpenAPISpec,
	Operation,
	Parameter,
	SchemaObject,
} from "./types.js";

const HTTP_METHODS = ["get", "post", "put", "patch", "delete"] as const;

/**
 * Convert an OpenAPI 3.x spec to an AgentGate agents.json spec.
 */
export function convertOpenAPI(
	openapi: OpenAPISpec,
	options?: ConvertOptions,
): AgentSpec {
	const serviceName =
		options?.serviceName ?? slugify(openapi.info.title);
	const baseUrl =
		openapi.servers?.[0]?.url?.replace(/\/$/, "") ?? "https://api.example.com";
	const auth = extractAuth(openapi, options?.envVar);
	const maxIntents = options?.maxIntents ?? 20;

	const intents: Intent[] = [];

	for (const [path, pathItem] of Object.entries(openapi.paths)) {
		if (intents.length >= maxIntents) break;

		const pathParams = pathItem.parameters ?? [];

		for (const method of HTTP_METHODS) {
			if (intents.length >= maxIntents) break;

			const operation = pathItem[method];
			if (!operation) continue;

			// Filter by tags if specified
			if (options?.tags && options.tags.length > 0) {
				if (!operation.tags?.some((t) => options.tags!.includes(t))) continue;
			}

			// Filter by operationIds if specified
			if (options?.operationIds && options.operationIds.length > 0) {
				if (!operation.operationId) continue;
				if (!options.operationIds.includes(operation.operationId)) continue;
			}

			const intent = operationToIntent(
				method.toUpperCase() as Intent["endpoint"]["method"],
				path,
				operation,
				pathParams,
				openapi,
			);
			if (intent) intents.push(intent);
		}
	}

	return {
		version: "1.0",
		service: {
			name: serviceName,
			description:
				openapi.info.description ?? `${openapi.info.title} API`,
			baseUrl,
		},
		auth,
		intents,
	};
}

function operationToIntent(
	method: Intent["endpoint"]["method"],
	path: string,
	operation: Operation,
	pathParams: Parameter[],
	spec: OpenAPISpec,
): Intent | null {
	const id =
		operation.operationId ?? generateId(method, path);
	const description =
		operation.summary ?? operation.description ?? `${method} ${path}`;

	// Collect all parameters
	const allParams = [...pathParams, ...(operation.parameters ?? [])];
	const params: IntentParam[] = [];

	// Path and query params
	for (const param of allParams) {
		if (param.in === "header" || param.in === "cookie") continue;
		params.push({
			name: param.name,
			type: schemaToType(param.schema),
			required: param.required ?? param.in === "path",
			description: param.description ?? param.name,
			in: param.in as "path" | "query",
		});
	}

	// Request body params
	if (operation.requestBody) {
		const bodySchema = extractBodySchema(operation.requestBody, spec);
		if (bodySchema?.properties) {
			const required = new Set(bodySchema.required ?? []);
			for (const [name, prop] of Object.entries(bodySchema.properties)) {
				params.push({
					name,
					type: schemaToType(prop),
					required: required.has(name),
					description: prop.description ?? name,
					in: "body",
				});
			}
		}
	}

	// Generate patterns from the operation
	const patterns = generatePatterns(id, method, path, params);

	// Determine response shape
	const responseSchema = extractResponseSchema(operation, spec);
	const responseType = responseSchema?.type === "array" ? "array" : "object";

	return {
		id,
		description,
		patterns,
		endpoint: { method, path },
		params,
		response: {
			type: responseType as "object" | "array" | "string",
			description: description,
		},
	};
}

function generatePatterns(
	id: string,
	method: string,
	path: string,
	params: IntentParam[],
): string[] {
	const patterns: string[] = [];

	// Convert operationId to natural language: "createCustomer" → "create customer"
	const words = id
		.replace(/([a-z])([A-Z])/g, "$1 $2")
		.replace(/[_-]/g, " ")
		.toLowerCase();

	// Build param placeholders for required params
	const requiredParams = params
		.filter((p) => p.required && p.in !== "path")
		.slice(0, 3);
	const paramPlaceholders = requiredParams
		.map((p) => `{${p.name}}`)
		.join(" ");

	// Pattern 1: operationId as words + params
	if (paramPlaceholders) {
		patterns.push(`${words} ${paramPlaceholders}`);
	} else {
		patterns.push(words);
	}

	// Pattern 2: method-based alternative
	const methodVerb = methodToVerb(method);
	const resource = extractResource(path);
	if (resource) {
		if (paramPlaceholders) {
			patterns.push(`${methodVerb} ${resource} ${paramPlaceholders}`);
		} else {
			patterns.push(`${methodVerb} ${resource}`);
		}
	}

	return patterns;
}

function methodToVerb(method: string): string {
	switch (method) {
		case "GET":
			return "get";
		case "POST":
			return "create";
		case "PUT":
			return "update";
		case "PATCH":
			return "update";
		case "DELETE":
			return "delete";
		default:
			return method.toLowerCase();
	}
}

function extractResource(path: string): string | null {
	// "/v1/customers/{id}" → "customer"
	// "/api/users" → "users"
	const segments = path
		.split("/")
		.filter((s) => s && !s.startsWith("{") && !s.match(/^v\d/));
	const last = segments[segments.length - 1];
	return last ?? null;
}

function generateId(method: string, path: string): string {
	const resource = extractResource(path) ?? "resource";
	const verb = methodToVerb(method);
	return `${verb}_${resource}`.replace(/[^a-z0-9_]/g, "_");
}

function schemaToType(
	schema?: SchemaObject,
): "string" | "number" | "boolean" | "object" {
	if (!schema) return "string";
	switch (schema.type) {
		case "integer":
		case "number":
			return "number";
		case "boolean":
			return "boolean";
		case "object":
		case "array":
			return "object";
		default:
			return "string";
	}
}

function extractBodySchema(
	requestBody: NonNullable<Operation["requestBody"]>,
	spec: OpenAPISpec,
): SchemaObject | null {
	const content = requestBody.content;
	if (!content) return null;

	const jsonContent =
		content["application/json"] ?? content["application/x-www-form-urlencoded"];
	if (!jsonContent?.schema) return null;

	return resolveRef(jsonContent.schema, spec);
}

function extractResponseSchema(
	operation: Operation,
	spec: OpenAPISpec,
): SchemaObject | null {
	const responses = operation.responses;
	if (!responses) return null;

	const success = responses["200"] ?? responses["201"] ?? responses["204"];
	if (!success?.content) return null;

	const jsonContent = success.content["application/json"];
	if (!jsonContent?.schema) return null;

	return resolveRef(jsonContent.schema, spec);
}

function resolveRef(schema: SchemaObject, spec: OpenAPISpec): SchemaObject {
	if (!schema.$ref) return schema;

	// Handle "#/components/schemas/Foo"
	const parts = schema.$ref.replace("#/", "").split("/");
	let current: unknown = spec;
	for (const part of parts) {
		if (current && typeof current === "object") {
			current = (current as Record<string, unknown>)[part];
		}
	}
	return (current as SchemaObject) ?? schema;
}

function extractAuth(
	spec: OpenAPISpec,
	envVar?: string,
): AgentSpec["auth"] {
	const schemes = spec.components?.securitySchemes;
	if (!schemes) {
		return {
			type: "bearer",
			envVar: envVar ?? "API_KEY",
		};
	}

	for (const [, scheme] of Object.entries(schemes)) {
		if (scheme.type === "http" && scheme.scheme === "bearer") {
			return {
				type: "bearer",
				envVar: envVar ?? "API_KEY",
				prefix: "Bearer",
			};
		}
		if (scheme.type === "apiKey") {
			return {
				type: "api_key",
				envVar: envVar ?? "API_KEY",
				header: scheme.in === "header" ? scheme.name : undefined,
			};
		}
	}

	return {
		type: "bearer",
		envVar: envVar ?? "API_KEY",
	};
}

function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}
