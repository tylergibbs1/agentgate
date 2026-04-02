import { mkdtempSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Vault } from "./vault.js";

describe("Vault", () => {
	let vaultPath: string;
	let auditPath: string;
	let vault: Vault;

	beforeEach(() => {
		const tmp = mkdtempSync(join(tmpdir(), "agentgate-vault-"));
		vaultPath = join(tmp, "vault.json");
		auditPath = join(tmp, "audit.log");
		vault = new Vault({ vaultPath, auditPath });
	});

	afterEach(() => {
		vault.lock();
		try {
			unlinkSync(vaultPath);
		} catch {
			/* may not exist */
		}
		try {
			unlinkSync(auditPath);
		} catch {
			/* may not exist */
		}
	});

	it("throws when locked", () => {
		expect(() => vault.get("stripe")).toThrow("locked");
	});

	it("creates new vault on first unlock", () => {
		vault.unlock("password");
		expect(vault.list()).toEqual([]);
	});

	it("stores and retrieves credentials", () => {
		vault.unlock("password");
		vault.set("stripe", "sk_test_123", "bearer");
		expect(vault.get("stripe")).toBe("sk_test_123");
	});

	it("persists across unlock/lock cycles", () => {
		vault.unlock("password");
		vault.set("stripe", "sk_live_secret", "bearer");
		vault.lock();

		const vault2 = new Vault({ vaultPath });
		vault2.unlock("password");
		expect(vault2.get("stripe")).toBe("sk_live_secret");
		vault2.lock();
	});

	it("fails to decrypt with wrong passphrase", () => {
		vault.unlock("right");
		vault.set("stripe", "secret", "bearer");
		vault.lock();

		const vault2 = new Vault({ vaultPath });
		vault2.unlock("wrong");
		expect(() => vault2.get("stripe")).toThrow();
		vault2.lock();
	});

	it("updates existing credential", () => {
		vault.unlock("password");
		vault.set("stripe", "old_key", "bearer");
		vault.set("stripe", "new_key", "bearer");
		expect(vault.get("stripe")).toBe("new_key");
		expect(vault.list()).toEqual(["stripe"]);
	});

	it("deletes credential", () => {
		vault.unlock("password");
		vault.set("stripe", "key", "bearer");
		vault.delete("stripe");
		expect(vault.list()).toEqual([]);
		expect(() => vault.get("stripe")).toThrow("No credential");
	});

	it("lists multiple services", () => {
		vault.unlock("password");
		vault.set("stripe", "k1", "bearer");
		vault.set("resend", "k2", "api_key");
		vault.set("github", "k3", "bearer");
		expect(vault.list().sort()).toEqual(["github", "resend", "stripe"]);
	});

	describe("permissions", () => {
		it("denies by default", () => {
			vault.unlock("password");
			expect(vault.checkPermission("agent-1", "stripe", "read")).toBe(false);
		});

		it("grants and checks permission", () => {
			vault.unlock("password");
			vault.grantPermission({
				agentId: "agent-1",
				service: "stripe",
				operations: ["read"],
			});
			expect(vault.checkPermission("agent-1", "stripe", "read")).toBe(true);
			expect(vault.checkPermission("agent-1", "stripe", "write")).toBe(false);
		});

		it("revokes permission", () => {
			vault.unlock("password");
			vault.grantPermission({
				agentId: "agent-1",
				service: "stripe",
				operations: ["read", "write"],
			});
			vault.revokePermission("agent-1", "stripe");
			expect(vault.checkPermission("agent-1", "stripe", "read")).toBe(false);
		});

		it("blocks get with insufficient permission", () => {
			vault.unlock("password");
			vault.set("stripe", "key", "bearer");
			expect(() => vault.get("stripe", "agent-1")).toThrow("permission");
		});

		it("allows get with granted permission", () => {
			vault.unlock("password");
			vault.set("stripe", "sk_123", "bearer");
			vault.grantPermission({
				agentId: "agent-1",
				service: "stripe",
				operations: ["read"],
			});
			expect(vault.get("stripe", "agent-1")).toBe("sk_123");
		});
	});

	describe("audit log", () => {
		it("logs access attempts", () => {
			vault.unlock("password");
			vault.set("stripe", "key", "bearer");
			vault.grantPermission({
				agentId: "bot",
				service: "stripe",
				operations: ["read"],
			});
			vault.get("stripe", "bot");

			const entries = vault.getAuditLog();
			expect(entries.length).toBeGreaterThan(0);
			expect(entries[0]?.action).toBe("read_key");
			expect(entries[0]?.allowed).toBe(true);
		});

		it("logs denied access", () => {
			vault.unlock("password");
			vault.set("stripe", "key", "bearer");
			try {
				vault.get("stripe", "unauthorized-bot");
			} catch {
				/* expected */
			}

			const entries = vault.getAuditLog();
			expect(entries.some((e) => e.allowed === false)).toBe(true);
		});
	});
});
