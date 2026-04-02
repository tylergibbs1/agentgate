# AgentGate

DNS for the agent era. A protocol + SDK that lets AI agents discover and call internet APIs via natural language intents.

```typescript
import { Gate } from 'agentgate'

const gate = new Gate({ specs })

// Natural language in, real API call out
const customer = await gate.do("create customer alice@example.com")
const balance = await gate.do("get balance")
const email = await gate.do("send email to bob@example.com")
const user = await gate.do("get user octocat")
```

## How it works

API providers publish an `agents.json` spec file describing their capabilities as intents with natural language patterns. The SDK resolves intents to API calls:

```
"charge cus_123 $49.99"
  → resolves to stripe/create_charge
  → POST https://api.stripe.com/v1/charges { customer: "cus_123", amount: 4999, currency: "usd" }
  → returns Stripe Charge object
```

## Packages

| Package | Description |
|---|---|
| `@agentgate/schema` | `agents.json` JSON Schema spec + validator |
| `agentgate` | SDK + CLI — Gate class, resolvers, executor |
| `@agentgate/analytics` | SQLite event tracking and query aggregations |
| `@agentgate/vault` | AES-256-GCM encrypted credential storage |
| `@agentgate/crawler` | Discover and index `agents.json` from the web |
| `@agentgate/resolver-api` | Hono HTTP server for remote intent resolution |
| `@agentgate/registry` | Next.js static site for browsing APIs |

## Quick start

```bash
git clone https://github.com/tylergibbs1/agentgate
cd agentgate
pnpm install
pnpm build
```

### CLI

```bash
# Discover APIs by intent
npx agentgate discover "send email"

# Validate a spec file
npx agentgate validate specs/stripe.json

# Dry-run an intent (no API call)
npx agentgate run "charge cus_123 \$49.99" --dry-run

# List all services and intents
npx agentgate list
```

### SDK

```typescript
import { Gate } from 'agentgate'
import { readFileSync, readdirSync } from 'fs'

const specs = readdirSync('specs')
  .filter(f => f.endsWith('.json'))
  .map(f => JSON.parse(readFileSync(`specs/${f}`, 'utf-8')))

const gate = new Gate({
  specs,
  keys: { stripe: process.env.STRIPE_KEY }
})

// Single call
const result = await gate.do("charge cus_123 $49.99")
console.log(result.data) // Stripe Charge object

// Dry run — see what would execute without calling
const dry = new Gate({ specs, dryRun: true })
const plan = await dry.do("send email to alice@example.com")
console.log(plan.endpoint) // POST https://api.resend.com/emails
console.log(plan.params) // { to: "alice@example.com", ... }
```

### Multi-step flows

```typescript
// Create customer → subscribe to plan (chained)
const result = await gate.doFlow("stripe", "subscribe_new_customer", {
  email: "alice@example.com",
  price: "price_pro_monthly"
})
console.log(result.steps) // [create_customer result, create_subscription result]
```

### Resolver API

```bash
# Start the resolver server
node packages/resolver-api/dist/server.js

# Resolve via HTTP
curl -X POST http://localhost:3100/resolve \
  -H "Content-Type: application/json" \
  -d '{"intent": "send email to bob@example.com"}'

# Discover capabilities
curl "http://localhost:3100/discover?q=send+email"

# Browse specs
curl http://localhost:3100/specs
```

Or use the `HttpResolver` from the SDK to resolve remotely:

```typescript
import { Gate, HttpResolver } from 'agentgate'

const gate = new Gate({
  specs,
  resolver: new HttpResolver("http://localhost:3100")
})
const result = await gate.do("charge cus_123 $50")
```

### Vault

```typescript
import { Vault, VaultAuthProvider } from '@agentgate/vault'

const vault = new Vault({ vaultPath: './vault.json', auditPath: './audit.log' })
vault.unlock('my-passphrase')
vault.set('stripe', 'sk_live_...', 'bearer')
vault.grantPermission({ agentId: 'bot-1', service: 'stripe', operations: ['read'] })

const gate = new Gate({
  specs,
  auth: new VaultAuthProvider(vault, specs, 'bot-1')
})
await gate.do("get balance") // uses encrypted credential with permission check
```

### Registry

```bash
cd packages/registry
pnpm build        # static export to out/
npx serve out     # http://localhost:3000
```

### Crawler

```bash
# Crawl domains for agents.json
npx agentgate-crawl example.com api.stripe.com

# Or from a file
npx agentgate-crawl --file domains.txt --output index.json
```

## The agents.json spec

Drop at `example.com/.well-known/agents.json`:

```json
{
  "version": "1.0",
  "service": {
    "name": "my-api",
    "description": "My API service",
    "baseUrl": "https://api.example.com"
  },
  "auth": {
    "type": "bearer",
    "envVar": "MY_API_KEY"
  },
  "intents": [
    {
      "id": "create_thing",
      "description": "Create a new thing",
      "patterns": ["create thing {name}", "new thing {name}"],
      "endpoint": { "method": "POST", "path": "/v1/things" },
      "params": [
        {
          "name": "name",
          "type": "string",
          "required": true,
          "description": "Thing name",
          "in": "body"
        }
      ],
      "response": { "type": "object", "description": "Created thing" }
    }
  ]
}
```

5 specs included: Stripe, Resend, GitHub, Twilio, OpenAI (26 intents total).

## Tests

```bash
pnpm test    # 236 tests across 7 packages
```

## Architecture

```
Agent → gate.do("charge cus_123 $49.99")
         ↓
       Resolver (local pattern matching or remote HTTP)
         ↓
       Validator (check required params)
         ↓
       Auth (env vars, vault, or custom provider)
         ↓
       Executor (fetch with correct content-type)
         ↓
       Real API call → Stripe, Resend, GitHub, etc.
```

## License

MIT
