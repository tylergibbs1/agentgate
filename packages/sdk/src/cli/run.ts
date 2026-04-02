import type { AgentSpec } from "@grayhaven/agentgate-schema";
import { AgentGateError, ResolutionError } from "../errors.js";
import { Gate } from "../gate.js";
import type { DryRunResult, GateResult } from "../gate.js";

export async function runIntent(
	intent: string,
	specs: AgentSpec[],
	dryRun: boolean,
): Promise<void> {
	const gate = new Gate({ specs, dryRun });

	try {
		const result = await gate.do(intent);

		if (dryRun) {
			const dry = result as DryRunResult;
			console.log("\n  Dry Run — here's what would execute:\n");
			console.log(`  Service:  ${dry.service}`);
			console.log(`  Intent:   ${dry.intentId}`);
			console.log(`  Endpoint: ${dry.endpoint.method} ${dry.endpoint.url}`);
			console.log(`  Params:   ${JSON.stringify(dry.params, null, 2)}`);
			console.log(`  Confidence: ${Math.round(dry.confidence * 100)}%`);

			if (dry.alternatives.length > 0) {
				console.log("\n  Alternatives:");
				for (const alt of dry.alternatives) {
					console.log(
						`    ${alt.service} / ${alt.intentId} (${Math.round(alt.confidence * 100)}%)`,
					);
				}
			}
		} else {
			const exec = result as GateResult;
			console.log("\n  Executed successfully:\n");
			console.log(`  Service:  ${exec.service}`);
			console.log(`  Intent:   ${exec.intentId}`);
			console.log(`  Request:  ${exec.request.method} ${exec.request.url}`);
			console.log(`  Status:   ${exec.response.status}`);
			console.log(
				`  Timing:   ${exec.timing.resolvedMs}ms resolve, ${exec.timing.executedMs}ms execute`,
			);
			console.log("  Data:");
			console.log(`  ${JSON.stringify(exec.data, null, 2)}`);
		}
	} catch (e) {
		if (e instanceof ResolutionError) {
			console.error(`\n  Could not resolve: "${intent}"\n`);
			if (e.suggestions.length > 0) {
				console.error("  Did you mean:");
				for (const s of e.suggestions) {
					console.error(`    → ${s}`);
				}
			}
			process.exit(1);
		}
		if (e instanceof AgentGateError) {
			console.error(`\n  Error [${e.code}]: ${e.message}`);
			process.exit(1);
		}
		throw e;
	}
}
