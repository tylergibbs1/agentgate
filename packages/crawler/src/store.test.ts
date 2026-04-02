import { mkdtempSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readIndex, writeIndex } from "./store.js";
import type { SpecIndex } from "./types.js";

describe("store", () => {
	const tmpDir = mkdtempSync(join(tmpdir(), "agentgate-crawl-"));
	const indexPath = join(tmpDir, "index.json");

	afterEach(() => {
		try {
			unlinkSync(indexPath);
		} catch {
			/* may not exist */
		}
	});

	it("writes and reads an index", () => {
		const index: SpecIndex = {
			version: "1.0",
			updatedAt: "2026-04-02T00:00:00Z",
			entries: [
				{
					domain: "test.com",
					service: "test",
					description: "Test",
					baseUrl: "https://api.test.com",
					intentCount: 1,
					intents: [{ id: "x", description: "X", patterns: ["x {y}"] }],
					crawledAt: "2026-04-02T00:00:00Z",
					spec: {
						version: "1.0",
						service: {
							name: "test",
							description: "Test",
							baseUrl: "https://api.test.com",
						},
						auth: { type: "bearer", envVar: "K" },
						intents: [],
					},
				},
			],
		};

		writeIndex(index, indexPath);
		const loaded = readIndex(indexPath);
		expect(loaded.version).toBe("1.0");
		expect(loaded.entries).toHaveLength(1);
		expect(loaded.entries[0]?.service).toBe("test");
	});
});
