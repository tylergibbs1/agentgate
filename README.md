# AgentGate

DNS for the agent era. A protocol + SDK that lets AI agents discover and call internet APIs via natural language intents.

```typescript
import { Gate } from '@grayhaven/agentgate'

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
| `@grayhaven/agentgate-schema` | `agents.json` JSON Schema spec + validator |
| `@grayhaven/agentgate` | SDK + CLI — Gate class, resolvers, executor |
| `@grayhaven/agentgate-mcp` | MCP server — expose all APIs as tools for Claude, Cursor, etc. |
| `@grayhaven/agentgate-openapi` | Convert OpenAPI specs to agents.json |
| `@agentgate/analytics` | SQLite event tracking and query aggregations |
| `@agentgate/vault` | AES-256-GCM encrypted credential storage |
| `@agentgate/crawler` | Discover and index `agents.json` from the web |
| `@agentgate/resolver-api` | Hono HTTP server for remote intent resolution |

## Install

```bash
bun add @grayhaven/agentgate
```

## Quick start

```bash
git clone https://github.com/tylergibbs1/agentgate
cd agentgate
bun install
bun run build
```

### MCP Server

Add AgentGate to Claude Desktop, Cursor, Windsurf, or any MCP client. Every API becomes a tool.

```jsonc
// claude_desktop_config.json or .mcp.json
{
  "mcpServers": {
    "agentgate": {
      "command": "node",
      "args": ["path/to/agentgate/packages/mcp/dist/server.js"],
      "env": {
        "STRIPE_KEY": "sk_test_...",
        "RESEND_KEY": "re_..."
      }
    }
  }
}
```

This registers **56 tools** — one per intent across 15 APIs, plus `agentgate__do` (natural language), `agentgate__discover` (search), and `agentgate__dry_run` (preview).

### OpenAPI Converter

Convert any OpenAPI spec to agents.json in one command:

```bash
# From a file
agentgate-openapi petstore.json --name petstore --env PETSTORE_KEY -o specs/petstore.json

# From a URL
agentgate-openapi --url https://api.example.com/openapi.json -o specs/example.json

# Programmatic
import { convertOpenAPI } from '@grayhaven/agentgate-openapi'
const agentSpec = convertOpenAPI(openapiSpec, { serviceName: 'stripe' })
```

### CLI

```bash
# Discover APIs by intent
bunx agentgate discover "send email"

# Validate a spec file
bunx agentgate validate specs/stripe.json

# Dry-run an intent (no API call)
bunx agentgate run "charge cus_123 \$49.99" --dry-run

# List all services and intents
bunx agentgate list
```

### SDK

```typescript
import { Gate } from '@grayhaven/agentgate'
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
```

Or use the `HttpResolver` from the SDK to resolve remotely:

```typescript
import { Gate, HttpResolver } from '@grayhaven/agentgate'

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

### Crawler

```bash
# Crawl domains for agents.json
bunx agentgate-crawl example.com api.stripe.com

# Or from a file
bunx agentgate-crawl --file domains.txt --output index.json
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

15 specs included: Stripe, Resend, GitHub, Twilio, OpenAI, Anthropic, Slack, Discord, Cloudflare, Vercel, Postmark, SendGrid, Replicate, Supabase, Lemon Squeezy (53 intents total).

## Tests

```bash
bun run test    # 245 tests across 8 packages
```

## Architecture

```
Claude/Cursor/Agent
    ↓ (MCP or SDK)
  gate.do("charge cus_123 $49.99")
    ↓
  Resolver (local pattern matching or remote HTTP)
    ↓
  Auth (env vars, vault, or custom provider)
    ↓
  Executor (fetch with correct content-type)
    ↓
  Real API call → Stripe, Resend, GitHub, etc.
```

## License

MIT
