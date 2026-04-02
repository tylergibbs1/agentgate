#!/usr/bin/env bun
// AgentGate resolver benchmark — measures accuracy and speed
// Outputs: accuracy: <number> (0-100), avg_ms: <number>, total_correct: <number>/<number>

import { LocalResolver } from "./packages/sdk/dist/resolver/local.js";
import { readFileSync, readdirSync } from "fs";

const specs = readdirSync("specs")
	.filter((f) => f.endsWith(".json"))
	.map((f) => JSON.parse(readFileSync(`specs/${f}`, "utf-8")));

const resolver = new LocalResolver(specs);

// Test cases: [input, expectedService, expectedIntentId]
const testCases: [string, string, string][] = [
	// Stripe
	["charge cus_123 $49.99", "stripe", "create_charge"],
	["charge $25 to cus_456", "stripe", "create_charge"],
	["bill cus_789 $100", "stripe", "create_charge"],
	["create customer alice@test.com", "stripe", "create_customer"],
	["new customer bob@example.com", "stripe", "create_customer"],
	["get customer cus_abc", "stripe", "get_customer"],
	["retrieve customer cus_def", "stripe", "get_customer"],
	["create payment intent for $50", "stripe", "create_payment_intent"],
	["payment intent $29", "stripe", "create_payment_intent"],
	["list charges", "stripe", "list_charges"],
	["show charges", "stripe", "list_charges"],
	["refund charge ch_abc", "stripe", "create_refund"],
	["refund ch_xyz", "stripe", "create_refund"],
	["subscribe cus_123 to price_pro", "stripe", "create_subscription"],
	["get balance", "stripe", "get_balance"],
	["check balance", "stripe", "get_balance"],

	// Resend
	["send email to alice@test.com", "resend", "send_email"],
	["email bob@example.com", "resend", "send_email"],
	["get email em_123", "resend", "get_email"],
	["check email status em_456", "resend", "get_email"],
	["list domains", "resend", "list_domains"],
	["create api key my-key", "resend", "create_api_key"],

	// GitHub
	["get user octocat", "github", "get_user"],
	["look up user torvalds", "github", "get_user"],
	["list repos for octocat", "github", "list_repos"],
	["show repos for microsoft", "github", "list_repos"],
	["star octocat/hello-world", "github", "star_repo"],

	// Twilio
	["send sms to +15551234567 saying hello", "twilio", "send_sms"],
	["list messages", "twilio", "list_messages"],

	// OpenAI
	["ask openai what is life", "openai", "create_chat_completion"],
	["complete tell me a joke", "openai", "create_chat_completion"],
	["embed this sentence", "openai", "create_embedding"],
	["list openai models", "openai", "list_models"],
	["generate image a cat", "openai", "create_image"],
	["draw a sunset", "openai", "create_image"],

	// Anthropic
	["ask claude hello", "anthropic", "create_message"],
	["send message hello to claude", "anthropic", "create_message"],

	// Slack
	["send slack message hello to C123", "slack", "send_message"],
	["list slack channels", "slack", "list_channels"],

	// Discord
	["send discord message hello to 12345", "discord", "send_message"],

	// Cloudflare
	["list cloudflare zones", "cloudflare", "list_zones"],

	// Vercel
	["list vercel projects", "vercel", "list_projects"],
	["list deployments", "vercel", "list_deployments"],

	// Postmark
	["list postmark templates", "postmark", "list_templates"],

	// Replicate
	["list replicate models", "replicate", "list_models"],

	// Edge cases — should NOT match or should match correctly
	["make a sandwich", "_none_", "_none_"],
	["hello world", "_none_", "_none_"],
	["xyzzy plugh", "_none_", "_none_"],
];

let correct = 0;
let totalMs = 0;
const failures: string[] = [];

for (const [input, expectedService, expectedIntent] of testCases) {
	const start = performance.now();
	const result = resolver.resolve(input);
	const elapsed = performance.now() - start;
	totalMs += elapsed;

	if (expectedService === "_none_") {
		if (result === null) {
			correct++;
		} else {
			failures.push(`"${input}" → expected null, got ${result.service}/${result.intentId}`);
		}
	} else if (result && result.service === expectedService && result.intentId === expectedIntent) {
		correct++;
	} else {
		const got = result ? `${result.service}/${result.intentId}` : "null";
		failures.push(`"${input}" → expected ${expectedService}/${expectedIntent}, got ${got}`);
	}
}

const accuracy = (correct / testCases.length) * 100;
const avgMs = totalMs / testCases.length;

console.log(`accuracy: ${accuracy.toFixed(1)}`);
console.log(`avg_ms: ${avgMs.toFixed(3)}`);
console.log(`total_correct: ${correct}/${testCases.length}`);

if (failures.length > 0) {
	console.log(`failures: ${failures.length}`);
	for (const f of failures) {
		console.log(`  FAIL: ${f}`);
	}
}
