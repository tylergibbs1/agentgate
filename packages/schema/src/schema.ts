/** JSON Schema for agents.json spec files. */
export const agentSpecSchema = {
	$schema: "http://json-schema.org/draft-07/schema#",
	type: "object",
	required: ["version", "service", "auth", "intents"],
	additionalProperties: false,
	properties: {
		version: { type: "string", const: "1.0" },
		service: {
			type: "object",
			required: ["name", "description", "baseUrl"],
			additionalProperties: false,
			properties: {
				name: { type: "string", minLength: 1 },
				description: { type: "string", minLength: 1 },
				baseUrl: { type: "string", minLength: 1, pattern: "^https?://" },
			},
		},
		auth: {
			type: "object",
			required: ["type", "envVar"],
			additionalProperties: false,
			properties: {
				type: { type: "string", enum: ["api_key", "bearer", "oauth2"] },
				envVar: { type: "string", minLength: 1 },
				header: { type: "string" },
				prefix: { type: "string" },
			},
		},
		intents: {
			type: "array",
			minItems: 1,
			items: {
				type: "object",
				required: [
					"id",
					"description",
					"patterns",
					"endpoint",
					"params",
					"response",
				],
				additionalProperties: false,
				properties: {
					id: { type: "string", minLength: 1 },
					description: { type: "string", minLength: 1 },
					patterns: {
						type: "array",
						minItems: 1,
						items: { type: "string", minLength: 1 },
					},
					endpoint: {
						type: "object",
						required: ["method", "path"],
						additionalProperties: false,
						properties: {
							method: {
								type: "string",
								enum: ["GET", "POST", "PUT", "PATCH", "DELETE"],
							},
							path: { type: "string", minLength: 1 },
						},
					},
					params: {
						type: "array",
						items: {
							type: "object",
							required: ["name", "type", "required", "description", "in"],
							additionalProperties: false,
							properties: {
								name: { type: "string", minLength: 1 },
								type: {
									type: "string",
									enum: ["string", "number", "boolean", "object"],
								},
								required: { type: "boolean" },
								description: { type: "string", minLength: 1 },
								in: {
									type: "string",
									enum: ["body", "path", "query"],
								},
								default: {},
								transform: {
									type: "string",
									enum: ["cents"],
								},
								pattern: { type: "string" },
							},
						},
					},
					response: {
						type: "object",
						required: ["type", "description"],
						additionalProperties: false,
						properties: {
							type: {
								type: "string",
								enum: ["object", "array", "string"],
							},
							description: { type: "string", minLength: 1 },
							properties: {
								type: "object",
								additionalProperties: {
									type: "object",
									required: ["type", "description"],
									additionalProperties: false,
									properties: {
										type: { type: "string" },
										description: { type: "string" },
									},
								},
							},
						},
					},
					flow: {
						type: "array",
						items: {
							type: "object",
							required: ["intentId", "description"],
							additionalProperties: false,
							properties: {
								intentId: { type: "string", minLength: 1 },
								description: { type: "string", minLength: 1 },
								mapParams: {
									type: "object",
									additionalProperties: { type: "string" },
								},
							},
						},
					},
				},
			},
		},
	},
} as const;
