import { describe, expect, it } from "vitest";
import { convertOpenAPI } from "./convert.js";
import type { OpenAPISpec } from "./types.js";

const minimalSpec: OpenAPISpec = {
	openapi: "3.0.0",
	info: { title: "Test API", version: "1.0.0", description: "A test API" },
	servers: [{ url: "https://api.test.com" }],
	paths: {
		"/users": {
			get: {
				operationId: "listUsers",
				summary: "List all users",
				parameters: [
					{
						name: "limit",
						in: "query",
						description: "Max results",
						required: false,
						schema: { type: "integer" },
					},
				],
				responses: {
					"200": {
						description: "Success",
						content: {
							"application/json": {
								schema: { type: "array", items: { type: "object" } },
							},
						},
					},
				},
			},
			post: {
				operationId: "createUser",
				summary: "Create a user",
				requestBody: {
					content: {
						"application/json": {
							schema: {
								type: "object",
								required: ["email"],
								properties: {
									email: { type: "string", description: "User email" },
									name: { type: "string", description: "User name" },
								},
							},
						},
					},
				},
				responses: {
					"201": {
						description: "Created",
						content: {
							"application/json": { schema: { type: "object" } },
						},
					},
				},
			},
		},
		"/users/{id}": {
			get: {
				operationId: "getUser",
				summary: "Get a user by ID",
				parameters: [
					{
						name: "id",
						in: "path",
						required: true,
						schema: { type: "string" },
						description: "User ID",
					},
				],
				responses: {
					"200": { description: "Success" },
				},
			},
			delete: {
				operationId: "deleteUser",
				summary: "Delete a user",
				parameters: [
					{
						name: "id",
						in: "path",
						required: true,
						schema: { type: "string" },
						description: "User ID",
					},
				],
				responses: {
					"204": { description: "Deleted" },
				},
			},
		},
	},
	components: {
		securitySchemes: {
			bearerAuth: {
				type: "http",
				scheme: "bearer",
			},
		},
	},
};

describe("convertOpenAPI", () => {
	it("converts a minimal OpenAPI spec", () => {
		const result = convertOpenAPI(minimalSpec);
		expect(result.version).toBe("1.0");
		expect(result.service.name).toBe("test-api");
		expect(result.service.baseUrl).toBe("https://api.test.com");
		expect(result.intents.length).toBe(4);
	});

	it("extracts auth from security schemes", () => {
		const result = convertOpenAPI(minimalSpec);
		expect(result.auth.type).toBe("bearer");
		expect(result.auth.prefix).toBe("Bearer");
	});

	it("generates intent IDs from operationId", () => {
		const result = convertOpenAPI(minimalSpec);
		const ids = result.intents.map((i) => i.id);
		expect(ids).toContain("listUsers");
		expect(ids).toContain("createUser");
		expect(ids).toContain("getUser");
		expect(ids).toContain("deleteUser");
	});

	it("maps HTTP methods correctly", () => {
		const result = convertOpenAPI(minimalSpec);
		const list = result.intents.find((i) => i.id === "listUsers")!;
		expect(list.endpoint.method).toBe("GET");
		const create = result.intents.find((i) => i.id === "createUser")!;
		expect(create.endpoint.method).toBe("POST");
		const del = result.intents.find((i) => i.id === "deleteUser")!;
		expect(del.endpoint.method).toBe("DELETE");
	});

	it("extracts query params", () => {
		const result = convertOpenAPI(minimalSpec);
		const list = result.intents.find((i) => i.id === "listUsers")!;
		const limitParam = list.params.find((p) => p.name === "limit");
		expect(limitParam).toBeDefined();
		expect(limitParam!.type).toBe("number");
		expect(limitParam!.in).toBe("query");
		expect(limitParam!.required).toBe(false);
	});

	it("extracts path params", () => {
		const result = convertOpenAPI(minimalSpec);
		const get = result.intents.find((i) => i.id === "getUser")!;
		const idParam = get.params.find((p) => p.name === "id");
		expect(idParam).toBeDefined();
		expect(idParam!.in).toBe("path");
		expect(idParam!.required).toBe(true);
	});

	it("extracts request body params", () => {
		const result = convertOpenAPI(minimalSpec);
		const create = result.intents.find((i) => i.id === "createUser")!;
		const emailParam = create.params.find((p) => p.name === "email");
		expect(emailParam).toBeDefined();
		expect(emailParam!.in).toBe("body");
		expect(emailParam!.required).toBe(true);
		const nameParam = create.params.find((p) => p.name === "name");
		expect(nameParam!.required).toBe(false);
	});

	it("generates natural language patterns", () => {
		const result = convertOpenAPI(minimalSpec);
		const create = result.intents.find((i) => i.id === "createUser")!;
		expect(create.patterns.length).toBeGreaterThan(0);
		expect(create.patterns.some((p) => p.includes("{email}"))).toBe(true);
	});

	it("detects array response type", () => {
		const result = convertOpenAPI(minimalSpec);
		const list = result.intents.find((i) => i.id === "listUsers")!;
		expect(list.response.type).toBe("array");
	});

	it("respects maxIntents option", () => {
		const result = convertOpenAPI(minimalSpec, { maxIntents: 2 });
		expect(result.intents.length).toBe(2);
	});

	it("respects serviceName override", () => {
		const result = convertOpenAPI(minimalSpec, { serviceName: "my-api" });
		expect(result.service.name).toBe("my-api");
	});

	it("respects envVar override", () => {
		const result = convertOpenAPI(minimalSpec, { envVar: "MY_SECRET" });
		expect(result.auth.envVar).toBe("MY_SECRET");
	});

	it("handles apiKey security scheme", () => {
		const spec: OpenAPISpec = {
			...minimalSpec,
			components: {
				securitySchemes: {
					apiKey: {
						type: "apiKey",
						name: "X-Api-Key",
						in: "header",
					},
				},
			},
		};
		const result = convertOpenAPI(spec);
		expect(result.auth.type).toBe("api_key");
		expect(result.auth.header).toBe("X-Api-Key");
	});

	it("handles spec with no security schemes", () => {
		const spec: OpenAPISpec = { ...minimalSpec, components: undefined };
		const result = convertOpenAPI(spec);
		expect(result.auth.type).toBe("bearer");
	});

	it("handles $ref in request body", () => {
		const spec: OpenAPISpec = {
			...minimalSpec,
			paths: {
				"/items": {
					post: {
						operationId: "createItem",
						summary: "Create item",
						requestBody: {
							content: {
								"application/json": {
									schema: { $ref: "#/components/schemas/Item" },
								},
							},
						},
						responses: { "201": { description: "Created" } },
					},
				},
			},
			components: {
				...minimalSpec.components,
				schemas: {
					Item: {
						type: "object",
						required: ["title"],
						properties: {
							title: { type: "string", description: "Item title" },
							price: { type: "number", description: "Price" },
						},
					},
				},
			},
		};
		const result = convertOpenAPI(spec);
		const create = result.intents[0]!;
		expect(create.params.find((p) => p.name === "title")).toBeDefined();
		expect(create.params.find((p) => p.name === "price")?.type).toBe("number");
	});
});
