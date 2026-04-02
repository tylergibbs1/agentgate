import { describe, expect, it } from "vitest";
import { MemoryLogger } from "./logger.js";
import type { LogEntry } from "./logger.js";

function makeEntry(overrides?: Partial<LogEntry>): LogEntry {
	return {
		timestamp: "2026-04-02T00:00:00.000Z",
		type: "resolution",
		service: "test",
		intentId: "test_intent",
		input: "test input",
		...overrides,
	};
}

describe("MemoryLogger", () => {
	it("starts empty", () => {
		const logger = new MemoryLogger();
		expect(logger.entries()).toEqual([]);
	});

	it("accumulates log entries", () => {
		const logger = new MemoryLogger();
		logger.log(makeEntry({ service: "a" }));
		logger.log(makeEntry({ service: "b" }));
		expect(logger.entries()).toHaveLength(2);
		expect(logger.entries()[0]?.service).toBe("a");
		expect(logger.entries()[1]?.service).toBe("b");
	});

	it("preserves full entry structure", () => {
		const logger = new MemoryLogger();
		const entry = makeEntry({
			type: "execution",
			request: {
				method: "POST",
				url: "https://api.test.com/v1",
				body: { key: "val" },
			},
			response: { status: 200, durationMs: 42 },
		});
		logger.log(entry);
		expect(logger.entries()[0]).toEqual(entry);
	});

	it("returns entries as readonly", () => {
		const logger = new MemoryLogger();
		logger.log(makeEntry());
		const entries = logger.entries();
		// TypeScript enforces readonly, but verify the reference is stable
		expect(entries).toHaveLength(1);
		logger.log(makeEntry());
		// Same array reference, so it reflects new entries
		expect(entries).toHaveLength(2);
	});
});
