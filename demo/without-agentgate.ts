// ❌ WITHOUT AGENTGATE — The old way
// Task: Onboard a new user (create customer, send welcome email, check their GitHub)
// Requires: 3 SDK installs, 3 configs, ~80 lines

import Stripe from "stripe";
import { Resend } from "resend";

// Step 1: Install and configure each SDK separately
//   bun add stripe resend
//   + read Stripe docs for API version
//   + read Resend docs for send format
//   + read GitHub REST API docs for endpoints

const stripe = new Stripe(process.env.STRIPE_KEY!, {
	apiVersion: "2024-12-18.acacia",
});

const resend = new Resend(process.env.RESEND_KEY!);

// Step 2: Create Stripe customer — need to know the exact method name
const customer = await stripe.customers.create({
	email: "alice@startup.com",
});
console.log("Customer:", customer.id);

// Step 3: Send welcome email — different SDK, different API shape
const email = await resend.emails.send({
	from: "onboarding@resend.dev",
	to: "delivered@resend.dev",
	subject: "Welcome!",
	text: "Thanks for signing up.",
});
console.log("Email:", email.data?.id);

// Step 4: Check GitHub profile — no SDK, raw fetch
const ghRes = await fetch("https://api.github.com/users/tylergibbs1");
const ghData = await ghRes.json();
console.log("GitHub:", ghData.login, "—", ghData.public_repos, "repos");

// Step 5: Create payment intent — back to Stripe SDK
const pi = await stripe.paymentIntents.create({
	amount: 2900,
	currency: "usd",
});
console.log("Payment:", pi.id, "$" + pi.amount / 100);

// Step 6: List their charges — another Stripe method
const charges = await stripe.charges.list({ limit: 5 });
console.log("Charges:", charges.data.length);

// Result: 3 imports, 3 configs, 5 different API call patterns,
// each with its own types, error handling, and docs to read.
// And this is only 3 services. Imagine 10.
