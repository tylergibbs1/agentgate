import type { AgentSpec } from "@agentgate/schema";
import type { Vault } from "./vault.js";

export interface AuthHeader {
	name: string;
	value: string;
}

export interface AuthProvider {
	getAuth(service: string): AuthHeader;
}

export class VaultAuthProvider implements AuthProvider {
	private readonly specsByService: Map<string, AgentSpec>;

	constructor(
		private readonly vault: Vault,
		specs: AgentSpec[],
		private readonly agentId?: string,
	) {
		this.specsByService = new Map(specs.map((s) => [s.service.name, s]));
	}

	getAuth(service: string): AuthHeader {
		const spec = this.specsByService.get(service);
		if (!spec) {
			throw new Error(`Unknown service "${service}"`);
		}

		const key = this.vault.get(service, this.agentId);
		const { auth } = spec;

		const headerName = auth.header ?? "Authorization";
		const prefix = auth.prefix ?? (auth.type === "bearer" ? "Bearer" : "");
		const value = prefix ? `${prefix} ${key}` : key;

		return { name: headerName, value };
	}
}
