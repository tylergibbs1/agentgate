# AgentGate Demo

## The Problem

Onboard a user: create Stripe customer, send welcome email, check GitHub, create payment intent.

### Without AgentGate — 3 SDKs, 3 configs, 80+ lines

```typescript
import Stripe from "stripe";
import { Resend } from "resend";

const stripe = new Stripe(process.env.STRIPE_KEY!, { apiVersion: "2024-12-18.acacia" });
const resend = new Resend(process.env.RESEND_KEY!);

const customer = await stripe.customers.create({ email: "alice@startup.com" });
const email = await resend.emails.send({ from: "...", to: "...", subject: "...", text: "..." });
const gh = await fetch("https://api.github.com/users/alice");
const pi = await stripe.paymentIntents.create({ amount: 2900, currency: "usd" });
const charges = await stripe.charges.list({ limit: 5 });
```

3 imports. 3 different API patterns. 3 sets of docs to read.

### With AgentGate — 1 import, 0 configs, 10 lines

```typescript
import { Gate } from "agentgate";

const gate = new Gate({ specs });

const customer = await gate.do("create customer alice@startup.com");
const email = await gate.do("send email to alice@startup.com");
const gh = await gate.do("get user alice");
const pi = await gate.do("create payment intent for $29");
const charges = await gate.do("list charges");
```

1 import. 1 interface. Natural language in, real API calls out.

## Run it

```bash
# Set API keys
export STRIPE_KEY=sk_test_...
export RESEND_KEY=re_...

# Run the agent demo
bun run demo/agent.ts

# Run the comparison demo
bun run demo/with-agentgate.ts
```

## What happens

Real API calls. Real data. Real money (test mode).

```
╔═══════════════════════════════════════╗
║   AgentGate — Agent Demo              ║
║   Natural language → Real API calls    ║
╚═══════════════════════════════════════╝

┌─ Agent: Onboarding delivered@resend.dev
│
├─ Created Stripe customer: cus_UGPUAxJ5mTQP9c
├─ Sent welcome email: 589188b6-b50d-476c-97cb-3f05fe43cccd
├─ Created $29 payment intent: pi_3THsfIQ051u1yFDg1xTATPUn
├─ Found GitHub: delivered (9 repos)
│
└─ Done. 4 API calls, 1381ms total
```
