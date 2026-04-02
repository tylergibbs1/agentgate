import { bigint, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import type { AgentSpec } from "@agentgate/schema";

export const specs = pgTable("specs", {
	id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
	name: text("name").unique().notNull(),
	spec: jsonb("spec").$type<AgentSpec>().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
