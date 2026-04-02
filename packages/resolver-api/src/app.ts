import type { AgentSpec } from "@grayhaven/agentgate-schema";
import { LocalResolver } from "@grayhaven/agentgate";
import { Hono } from "hono";
import { cors } from "hono/cors";

export function createApp(specs: AgentSpec[]) {
	const resolver = new LocalResolver(specs);
	const app = new Hono();

	app.use("*", cors());

	app.get("/health", (c) => {
		const intentCount = specs.reduce((sum, s) => sum + s.intents.length, 0);
		return c.json({
			status: "ok",
			specCount: specs.length,
			intentCount,
		});
	});

	app.post("/resolve", async (c) => {
		let body: { intent?: string };
		try {
			body = await c.req.json<{ intent: string }>();
		} catch {
			return c.json({ error: "Invalid or missing JSON body" }, 400);
		}
		if (!body.intent) {
			return c.json({ error: "Missing 'intent' field" }, 400);
		}

		const result = resolver.resolve(body.intent);
		if (!result) {
			const suggestions = resolver
				.discover(body.intent)
				.slice(0, 5)
				.map((d) => ({
					service: d.service,
					intentId: d.intentId,
					description: d.description,
					confidence: Math.round(d.confidence * 100) / 100,
				}));
			return c.json({ error: "No matching intent", suggestions }, 404);
		}

		return c.json({
			service: result.service,
			intentId: result.intentId,
			description: result.description,
			endpoint: result.endpoint,
			params: result.params,
			confidence: Math.round(result.confidence * 100) / 100,
			authRequired: result.authRequired,
			contentType: result.contentType,
			alternatives: result.alternatives.map((a) => ({
				service: a.service,
				intentId: a.intentId,
				description: a.description,
				confidence: Math.round(a.confidence * 100) / 100,
			})),
		});
	});

	app.get("/discover", (c) => {
		const q = c.req.query("q");
		if (!q) {
			return c.json({ error: "Missing 'q' query parameter" }, 400);
		}

		const limit = Number.parseInt(c.req.query("limit") ?? "10");
		const results = resolver.discover(q).slice(0, limit);

		return c.json({ results });
	});

	app.get("/specs", (c) => {
		return c.json({
			specs: specs.map((s) => ({
				service: s.service.name,
				description: s.service.description,
				baseUrl: s.service.baseUrl,
				intentCount: s.intents.length,
				authType: s.auth.type,
			})),
		});
	});

	app.get("/specs/:service", (c) => {
		const name = c.req.param("service");
		const spec = specs.find((s) => s.service.name === name);
		if (!spec) {
			return c.json({ error: `Service "${name}" not found` }, 404);
		}
		return c.json(spec);
	});

	return app;
}
