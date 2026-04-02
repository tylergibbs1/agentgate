import { appendFileSync, readFileSync } from "node:fs";
import type { AuditEntry } from "./types.js";

export class AuditLog {
	constructor(private readonly path: string) {}

	append(entry: AuditEntry): void {
		const line = `${JSON.stringify(entry)}\n`;
		appendFileSync(this.path, line, "utf-8");
	}

	read(): AuditEntry[] {
		let raw: string;
		try {
			raw = readFileSync(this.path, "utf-8");
		} catch {
			return [];
		}
		return raw
			.trim()
			.split("\n")
			.filter(Boolean)
			.map((line) => JSON.parse(line) as AuditEntry);
	}
}
