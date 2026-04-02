import Ajv from "ajv";
import { agentSpecSchema } from "./schema.js";
import type { AgentSpec } from "./types.js";

export interface ValidationResult {
	valid: boolean;
	errors: string[];
	spec: AgentSpec | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- CJS interop
const AjvClass = (Ajv as any).default ?? Ajv;
const ajv = new AjvClass({ allErrors: true });
const validate = ajv.compile(agentSpecSchema);

/** Validate a JSON object against the agents.json schema. */
export function validateSpec(data: unknown): ValidationResult {
	const valid = validate(data);
	if (valid) {
		return { valid: true, errors: [], spec: data as AgentSpec };
	}
	const errors = (validate.errors ?? []).map(
		(e: { instancePath?: string; message?: string }) => {
			const path = e.instancePath || "/";
			return `${path}: ${e.message ?? "unknown error"}`;
		},
	);
	return { valid: false, errors, spec: null };
}
