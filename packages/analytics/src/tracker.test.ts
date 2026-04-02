import { afterEach, describe, expect, it } from "vitest";
import { Tracker } from "./tracker.js";

describe("Tracker", () => {
	let tracker: Tracker;

	afterEach(() => {
		tracker?.close();
	});

	it("tracks and queries events", () => {
		tracker = new Tracker({ dbPath: ":memory:" });
		tracker.track({
			type: "resolution",
			service: "stripe",
			intentId: "create_charge",
			input: "charge cus_123 $50",
			success: true,
			durationMs: 3,
		});
		const events = tracker.query({});
		expect(events).toHaveLength(1);
		expect(events[0]?.service).toBe("stripe");
		expect(events[0]?.id).toBeDefined();
		expect(events[0]?.timestamp).toBeDefined();
	});

	it("auto-generates id and timestamp", () => {
		tracker = new Tracker({ dbPath: ":memory:" });
		tracker.track({
			type: "execution",
			service: "resend",
			intentId: "send_email",
			input: "send email",
			success: true,
			durationMs: 100,
		});
		const events = tracker.query({});
		expect(events[0]?.id).toMatch(/^[0-9a-f-]+$/);
		expect(events[0]?.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
	});

	it("respects explicit id and timestamp", () => {
		tracker = new Tracker({ dbPath: ":memory:" });
		tracker.track({
			id: "custom_id",
			timestamp: "2026-01-01T00:00:00Z",
			type: "resolution",
			service: "stripe",
			intentId: "get_balance",
			input: "get balance",
			success: true,
			durationMs: 1,
		});
		const events = tracker.query({});
		expect(events[0]?.id).toBe("custom_id");
		expect(events[0]?.timestamp).toBe("2026-01-01T00:00:00Z");
	});

	it("no-ops when disabled", () => {
		tracker = new Tracker({ enabled: false });
		tracker.track({
			type: "resolution",
			service: "x",
			intentId: "y",
			input: "z",
			success: true,
			durationMs: 0,
		});
		expect(tracker.query({})).toEqual([]);
		expect(tracker.topIntents()).toEqual([]);
		expect(tracker.failureRate()).toBe(0);
	});

	it("computes topIntents through tracker", () => {
		tracker = new Tracker({ dbPath: ":memory:" });
		for (let i = 0; i < 5; i++) {
			tracker.track({
				type: "execution",
				service: "stripe",
				intentId: "create_charge",
				input: "charge",
				success: true,
				durationMs: 10,
			});
		}
		tracker.track({
			type: "execution",
			service: "resend",
			intentId: "send_email",
			input: "email",
			success: true,
			durationMs: 10,
		});
		const top = tracker.topIntents(2);
		expect(top[0]?.key).toBe("stripe/create_charge");
		expect(top[0]?.count).toBe(5);
	});

	it("computes failureRate through tracker", () => {
		tracker = new Tracker({ dbPath: ":memory:" });
		tracker.track({
			type: "execution",
			service: "s",
			intentId: "i",
			input: "x",
			success: true,
			durationMs: 1,
		});
		tracker.track({
			type: "execution",
			service: "s",
			intentId: "i",
			input: "x",
			success: false,
			durationMs: 1,
		});
		expect(tracker.failureRate()).toBeCloseTo(0.5);
	});
});
