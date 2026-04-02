export interface VaultConfig {
	vaultPath: string;
	auditPath?: string;
}

export interface StoredCredential {
	service: string;
	authType: "api_key" | "bearer" | "oauth2";
	ciphertext: string;
	iv: string;
	tag: string;
	createdAt: string;
	updatedAt: string;
}

export interface VaultData {
	version: "1.0";
	salt: string;
	credentials: StoredCredential[];
	permissions: PermissionScope[];
}

export interface PermissionScope {
	agentId: string;
	service: string;
	operations: ("read" | "write" | "delete")[];
}

export interface AuditEntry {
	timestamp: string;
	agentId: string;
	service: string;
	action: "read_key" | "write_key" | "delete_key" | "permission_check";
	allowed: boolean;
}
