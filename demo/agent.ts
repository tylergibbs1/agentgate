// 🤖 AGENTGATE AGENT DEMO
// An AI agent that onboards users using natural language intents.
// Zero SDK imports. Zero API-specific code. Just intent → result.

import { Gate } from "../packages/sdk/dist/index.js";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const specsDir = join(import.meta.dirname, "..", "specs");
const specs = readdirSync(specsDir)
	.filter((f) => f.endsWith(".json"))
	.map((f) => JSON.parse(readFileSync(join(specsDir, f), "utf-8")));

const gate = new Gate({ specs });

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// The agent receives a task: "Onboard alice@startup.com"
// It decides what APIs to call. AgentGate handles the rest.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function onboardUser(email: string) {
	console.log(`\n  ┌─ Agent: Onboarding ${email}\n  │`);

	// 1. Create their account
	const customer = await gate.do(`create customer ${email}`);
	console.log(`  ├─ Created Stripe customer: ${customer.data.id}`);

	// 2. Send welcome email
	const mail = await gate.do(`send email to ${email}`);
	console.log(`  ├─ Sent welcome email: ${mail.data.id}`);

	// 3. Set up billing
	const pi = await gate.do("create payment intent for $29");
	console.log(`  ├─ Created $29 payment intent: ${pi.data.id}`);

	// 4. Check if they have a GitHub presence
	const username = email.split("@")[0];
	try {
		const gh = await gate.do(`get user ${username}`);
		console.log(`  ├─ Found GitHub: ${gh.data.login} (${gh.data.public_repos} repos)`);
	} catch {
		console.log(`  ├─ No GitHub profile for ${username}`);
	}

	console.log(`  │`);
	console.log(`  └─ Done. ${gate.logs.length} API calls, ${gate.logs.reduce((s, l) => s + (l.response?.durationMs ?? 0), 0)}ms total\n`);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Run the demo
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

console.log("  ╔═══════════════════════════════════════╗");
console.log("  ║   AgentGate — Agent Demo              ║");
console.log("  ║   Natural language → Real API calls    ║");
console.log("  ╚═══════════════════════════════════════╝");

await onboardUser("delivered@resend.dev");

// Show what the agent can discover
console.log("  Agent can also discover capabilities:\n");
const capabilities = await gate.discover("payment");
for (const cap of capabilities.slice(0, 5)) {
	console.log(`    ${cap.service}/${cap.intentId} — ${cap.description}`);
}

console.log("\n  Full audit trail:");
for (const log of gate.logs) {
	console.log(`    ${log.response?.status} ${log.service}/${log.intentId} (${log.response?.durationMs}ms)`);
}
