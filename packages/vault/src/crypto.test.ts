import { describe, expect, it } from "vitest";
import { decrypt, deriveKey, encrypt, generateSalt } from "./crypto.js";

describe("crypto", () => {
	it("generates unique salts", () => {
		const a = generateSalt();
		const b = generateSalt();
		expect(a).not.toBe(b);
		expect(a.length).toBeGreaterThan(10);
	});

	it("derives consistent key from same passphrase and salt", () => {
		const salt = generateSalt();
		const k1 = deriveKey("mypassword", salt);
		const k2 = deriveKey("mypassword", salt);
		expect(k1.equals(k2)).toBe(true);
	});

	it("derives different keys from different passphrases", () => {
		const salt = generateSalt();
		const k1 = deriveKey("password1", salt);
		const k2 = deriveKey("password2", salt);
		expect(k1.equals(k2)).toBe(false);
	});

	it("encrypts and decrypts correctly", () => {
		const salt = generateSalt();
		const key = deriveKey("test", salt);
		const { ciphertext, iv, tag } = encrypt("sk_test_secret", key);
		const decrypted = decrypt(ciphertext, iv, tag, key);
		expect(decrypted).toBe("sk_test_secret");
	});

	it("ciphertext is different from plaintext", () => {
		const key = deriveKey("test", generateSalt());
		const { ciphertext } = encrypt("hello", key);
		expect(ciphertext).not.toBe("hello");
	});

	it("decrypt fails with wrong key", () => {
		const salt = generateSalt();
		const key1 = deriveKey("right", salt);
		const key2 = deriveKey("wrong", salt);
		const { ciphertext, iv, tag } = encrypt("secret", key1);
		expect(() => decrypt(ciphertext, iv, tag, key2)).toThrow();
	});

	it("decrypt fails with tampered ciphertext", () => {
		const key = deriveKey("test", generateSalt());
		const { ciphertext, iv, tag } = encrypt("secret", key);
		const tampered = `X${ciphertext.slice(1)}`;
		expect(() => decrypt(tampered, iv, tag, key)).toThrow();
	});

	it("each encryption produces unique iv", () => {
		const key = deriveKey("test", generateSalt());
		const a = encrypt("same", key);
		const b = encrypt("same", key);
		expect(a.iv).not.toBe(b.iv);
		expect(a.ciphertext).not.toBe(b.ciphertext);
	});
});
