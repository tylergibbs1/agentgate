// ✅ WITH AGENTGATE — Same task, one interface
// Task: Onboard a new user (create customer, send welcome email, check their GitHub)
// Requires: 1 install, 0 configs, ~20 lines

import { Gate } from "../packages/sdk/dist/index.js";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const specsDir = join(import.meta.dirname, "..", "specs");
const specs = readdirSync(specsDir)
	.filter((f) => f.endsWith(".json"))
	.map((f) => JSON.parse(readFileSync(join(specsDir, f), "utf-8")));

const gate = new Gate({ specs });

// That's it. No Stripe SDK, no Resend SDK, no Octokit. Just intents.

const customer = await gate.do("create customer alice@startup.com");
console.log("Customer:", customer.data.id);

const email = await gate.do("send email to delivered@resend.dev");
console.log("Email:", email.data.id);

const gh = await gate.do("get user tylergibbs1");
console.log("GitHub:", gh.data.login, "—", gh.data.public_repos, "repos");

const pi = await gate.do("create payment intent for $29");
console.log("Payment:", pi.data.id, "$" + pi.data.amount / 100);

const charges = await gate.do("list charges");
console.log("Charges:", charges.data.data.length);

// Same result. One import. One interface. Natural language in, real API calls out.
// Add a new service? Just drop an agents.json file. No new SDK to learn.
