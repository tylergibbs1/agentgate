import type { AgentSpec } from "@grayhaven/agentgate-schema";
import { AuthError } from "../errors.js";
import type { AuthHeader, AuthProvider } from "./types.js";

export class EnvAuthProvider implements AuthProvider {
	private readonly keys: Record<string, string>;
	private readonly specsByService: Map<string, AgentSpec>;

	constructor(specs: AgentSpec[], keys?: Record<string, string>) {
		this.keys = keys ?? {};
		this.specsByService = new Map(specs.map((s) => [s.service.name, s]));
	}

	getAuth(service: string): AuthHeader {
		const spec = this.specsByService.get(service);
		if (!spec) {
			throw new AuthError(service, "UNKNOWN");
		}

		const { auth } = spec;

		// Check explicit keys first, then env vars
		const key =
			this.keys[service] ?? this.keys[auth.envVar] ?? process.env[auth.envVar];

		if (!key) {
			throw new AuthError(service, auth.envVar);
		}

		const headerName = auth.header ?? "Authorization";
		const prefix = auth.prefix ?? (auth.type === "bearer" ? "Bearer" : "");
		const value = prefix ? `${prefix} ${key}` : key;

		return { name: headerName, value };
	}
}
