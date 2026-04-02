export type {
	AuditEntry,
	PermissionScope,
	StoredCredential,
	VaultConfig,
	VaultData,
} from "./types.js";
export { Vault } from "./vault.js";
export {
	VaultAuthProvider,
	type AuthHeader,
	type AuthProvider,
} from "./provider.js";
export { AuditLog } from "./audit.js";
export { decrypt, deriveKey, encrypt, generateSalt } from "./crypto.js";
