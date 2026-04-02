import type { AgentSpec } from "@grayhaven/agentgate-schema";

export function runList(specs: AgentSpec[]): void {
	if (specs.length === 0) {
		console.log("No specs loaded.");
		return;
	}

	const totalIntents = specs.reduce((sum, s) => sum + s.intents.length, 0);
	console.log(
		`\n  ${specs.length} service${specs.length > 1 ? "s" : ""}, ${totalIntents} intents:\n`,
	);

	for (const spec of specs) {
		console.log(`  ${spec.service.name} — ${spec.service.description}`);
		console.log(`    Base URL: ${spec.service.baseUrl}`);
		console.log(`    Auth: ${spec.auth.type} via ${spec.auth.envVar}`);
		console.log(`    Intents (${spec.intents.length}):`);
		for (const intent of spec.intents) {
			console.log(`      ${intent.id} — ${intent.description}`);
		}
		console.log();
	}
}
