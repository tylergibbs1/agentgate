#!/usr/bin/env bun
// Seed the Supabase specs table with all local spec files via Drizzle

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { specs } from "../db/schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
	console.error("Missing DATABASE_URL");
	process.exit(1);
}

const client = postgres(connectionString, { prepare: false });
const db = drizzle(client);

const specsDir = resolve(import.meta.dirname, "..", "..", "..", "..", "specs");
const files = readdirSync(specsDir).filter((f) => f.endsWith(".json"));

console.log(`Seeding ${files.length} specs from ${specsDir}\n`);

for (const file of files) {
	const spec = JSON.parse(readFileSync(join(specsDir, file), "utf-8"));
	const name = spec.service.name;

	try {
		await db
			.insert(specs)
			.values({ name, spec })
			.onConflictDoUpdate({
				target: specs.name,
				set: { spec, updatedAt: new Date() },
			});
		console.log(`  ✓ ${name} (${spec.intents.length} intents)`);
	} catch (e) {
		console.error(`  ✗ ${name}: ${(e as Error).message}`);
	}
}

console.log("\nDone.");
await client.end();
