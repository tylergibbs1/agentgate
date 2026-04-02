import {
	createCipheriv,
	createDecipheriv,
	pbkdf2Sync,
	randomBytes,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const SALT_LENGTH = 32;
const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_DIGEST = "sha512";

export function generateSalt(): string {
	return randomBytes(SALT_LENGTH).toString("base64");
}

export function deriveKey(passphrase: string, salt: string): Buffer {
	return pbkdf2Sync(
		passphrase,
		Buffer.from(salt, "base64"),
		PBKDF2_ITERATIONS,
		KEY_LENGTH,
		PBKDF2_DIGEST,
	);
}

export function encrypt(
	plaintext: string,
	key: Buffer,
): { ciphertext: string; iv: string; tag: string } {
	const iv = randomBytes(IV_LENGTH);
	const cipher = createCipheriv(ALGORITHM, key, iv);
	let encrypted = cipher.update(plaintext, "utf8", "base64");
	encrypted += cipher.final("base64");
	const tag = cipher.getAuthTag();
	return {
		ciphertext: encrypted,
		iv: iv.toString("base64"),
		tag: tag.toString("base64"),
	};
}

export function decrypt(
	ciphertext: string,
	iv: string,
	tag: string,
	key: Buffer,
): string {
	const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, "base64"));
	decipher.setAuthTag(Buffer.from(tag, "base64"));
	let decrypted = decipher.update(ciphertext, "base64", "utf8");
	decrypted += decipher.final("utf8");
	return decrypted;
}
