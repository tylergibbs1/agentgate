import { readFileSync } from "node:fs";
import { validateSpec } from "@grayhaven/agentgate-schema";

export function runValidate(filePath: string): void {
	let raw: string;
	try {
		raw = readFileSync(filePath, "utf-8");
	} catch {
		console.error(`Error: Could not read file "${filePath}"`);
		process.exit(1);
	}

	let data: unknown;
	try {
		data = JSON.parse(raw);
	} catch (e) {
		console.error(`Error: "${filePath}" is not valid JSON`);
		if (e instanceof Error) console.error(`  ${e.message}`);
		process.exit(1);
	}

	const result = validateSpec(data);

	if (result.valid) {
		const spec = result.spec!;
		console.log("✓ Valid agents.json spec");
		console.log(`  Service: ${spec.service.name}`);
		console.log(`  Intents: ${spec.intents.length}`);
		console.log(`  Auth: ${spec.auth.type} via ${spec.auth.envVar}`);
	} else {
		console.error(
			`✗ Invalid agents.json spec (${result.errors.length} error${result.errors.length > 1 ? "s" : ""}):`,
		);
		for (const err of result.errors) {
			console.error(`  ${err}`);
		}
		process.exit(1);
	}
}
