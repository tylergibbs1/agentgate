import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import type { AgentSpec } from "@agentgate/schema";

export interface ServiceSummary {
	name: string;
	description: string;
	baseUrl: string;
	authType: string;
	intentCount: number;
	intents: Array<{
		id: string;
		description: string;
		patterns: string[];
		method: string;
		path: string;
		paramCount: number;
	}>;
}

function getSpecsDir(): string {
	return (
		process.env.AGENTGATE_SPECS_DIR ??
		resolve(process.cwd(), "..", "..", "specs")
	);
}

export function loadAllSpecs(): AgentSpec[] {
	const dir = getSpecsDir();
	try {
		return readdirSync(dir)
			.filter((f) => f.endsWith(".json"))
			.map((f) => JSON.parse(readFileSync(join(dir, f), "utf-8")) as AgentSpec);
	} catch {
		return [];
	}
}

export function getAllServices(): ServiceSummary[] {
	return loadAllSpecs().map(specToSummary);
}

export function getService(name: string): ServiceSummary | undefined {
	const spec = loadAllSpecs().find((s) => s.service.name === name);
	return spec ? specToSummary(spec) : undefined;
}

function specToSummary(spec: AgentSpec): ServiceSummary {
	return {
		name: spec.service.name,
		description: spec.service.description,
		baseUrl: spec.service.baseUrl,
		authType: spec.auth.type,
		intentCount: spec.intents.length,
		intents: spec.intents.map((i) => ({
			id: i.id,
			description: i.description,
			patterns: i.patterns,
			method: i.endpoint.method,
			path: i.endpoint.path,
			paramCount: i.params.length,
		})),
	};
}
