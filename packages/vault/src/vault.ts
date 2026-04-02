import { readFileSync, writeFileSync } from "node:fs";
import { AuditLog } from "./audit.js";
import { decrypt, deriveKey, encrypt, generateSalt } from "./crypto.js";
import type {
	AuditEntry,
	PermissionScope,
	StoredCredential,
	VaultConfig,
	VaultData,
} from "./types.js";

export class Vault {
	private data: VaultData | null = null;
	private key: Buffer | null = null;
	private readonly vaultPath: string;
	private readonly audit: AuditLog | null;

	constructor(config: VaultConfig) {
		this.vaultPath = config.vaultPath;
		this.audit = config.auditPath ? new AuditLog(config.auditPath) : null;
	}

	unlock(passphrase: string): void {
		let raw: string;
		try {
			raw = readFileSync(this.vaultPath, "utf-8");
			this.data = JSON.parse(raw) as VaultData;
		} catch {
			// No existing vault — create a new one
			const salt = generateSalt();
			this.data = {
				version: "1.0",
				salt,
				credentials: [],
				permissions: [],
			};
		}
		this.key = deriveKey(passphrase, this.data.salt);
	}

	lock(): void {
		this.key = null;
		this.data = null;
	}

	get(service: string, agentId?: string): string {
		this.ensureUnlocked();
		const cred = this.data?.credentials.find((c) => c.service === service);
		if (!cred) {
			throw new Error(`No credential stored for service "${service}"`);
		}

		if (agentId) {
			const allowed = this.checkPermission(agentId, service, "read");
			this.logAudit(agentId, service, "read_key", allowed);
			if (!allowed) {
				throw new Error(
					`Agent "${agentId}" does not have read permission for "${service}"`,
				);
			}
		}

		return decrypt(cred.ciphertext, cred.iv, cred.tag, this.key!);
	}

	set(
		service: string,
		key: string,
		authType: StoredCredential["authType"],
	): void {
		this.ensureUnlocked();
		const encrypted = encrypt(key, this.key!);
		const now = new Date().toISOString();

		const data = this.data!;
		const existing = data.credentials.findIndex((c) => c.service === service);
		const cred: StoredCredential = {
			service,
			authType,
			ciphertext: encrypted.ciphertext,
			iv: encrypted.iv,
			tag: encrypted.tag,
			// biome-ignore lint/style/noNonNullAssertion: index checked above
			createdAt: existing >= 0 ? data.credentials[existing]!.createdAt : now,
			updatedAt: now,
		};

		if (existing >= 0) {
			data.credentials[existing] = cred;
		} else {
			data.credentials.push(cred);
		}
		this.save();
	}

	delete(service: string): void {
		this.ensureUnlocked();
		const data = this.data!;
		data.credentials = data.credentials.filter((c) => c.service !== service);
		this.save();
	}

	list(): string[] {
		this.ensureUnlocked();
		// biome-ignore lint/style/noNonNullAssertion: ensureUnlocked guarantees non-null
		return this.data!.credentials.map((c) => c.service);
	}

	grantPermission(scope: PermissionScope): void {
		this.ensureUnlocked();
		const data = this.data!;
		data.permissions = data.permissions.filter(
			(p) => !(p.agentId === scope.agentId && p.service === scope.service),
		);
		data.permissions.push(scope);
		this.save();
	}

	revokePermission(agentId: string, service: string): void {
		this.ensureUnlocked();
		const data = this.data!;
		data.permissions = data.permissions.filter(
			(p) => !(p.agentId === agentId && p.service === service),
		);
		this.save();
	}

	checkPermission(agentId: string, service: string, op: string): boolean {
		this.ensureUnlocked();
		const perm = this.data?.permissions.find(
			(p) => p.agentId === agentId && p.service === service,
		);
		return perm
			? perm.operations.includes(op as "read" | "write" | "delete")
			: false;
	}

	getAuditLog(): AuditEntry[] {
		return this.audit?.read() ?? [];
	}

	private ensureUnlocked(): void {
		if (!this.key || !this.data) {
			throw new Error("Vault is locked. Call unlock() first.");
		}
	}

	private save(): void {
		writeFileSync(this.vaultPath, JSON.stringify(this.data, null, 2), "utf-8");
	}

	private logAudit(
		agentId: string,
		service: string,
		action: AuditEntry["action"],
		allowed: boolean,
	): void {
		this.audit?.append({
			timestamp: new Date().toISOString(),
			agentId,
			service,
			action,
			allowed,
		});
	}
}
