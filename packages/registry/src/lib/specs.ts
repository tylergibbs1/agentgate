import type { AgentSpec } from "@agentgate/schema";
import { eq } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import { specs as specsTable } from "@/db/schema";

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

// React.cache() deduplicates within a single request — if both
// layout and page call getAllServices, only one DB query fires.
export const getAllServices = cache(
	async (): Promise<ServiceSummary[]> => {
		const rows = await db.select().from(specsTable).orderBy(specsTable.name);
		return rows.map((row) => specToSummary(row.spec));
	},
);

export const getService = cache(
	async (name: string): Promise<ServiceSummary | undefined> => {
		const rows = await db
			.select()
			.from(specsTable)
			.where(eq(specsTable.name, name))
			.limit(1);

		const row = rows[0];
		return row ? specToSummary(row.spec) : undefined;
	},
);

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
