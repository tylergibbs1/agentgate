import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EventStore } from "./store.js";
import type { AnalyticsEvent } from "./types.js";

function makeEvent(overrides?: Partial<AnalyticsEvent>): AnalyticsEvent {
	return {
		id: `evt_${Math.random().toString(36).slice(2, 8)}`,
		timestamp: "2026-04-02T12:00:00.000Z",
		type: "resolution",
		service: "stripe",
		intentId: "create_charge",
		input: "charge cus_123 $49.99",
		success: true,
		durationMs: 5,
		...overrides,
	};
}

describe("EventStore", () => {
	let store: EventStore;

	beforeEach(() => {
		store = new EventStore(":memory:");
	});

	afterEach(() => {
		store.close();
	});

	it("inserts and queries events", () => {
		store.insert(makeEvent({ id: "1" }));
		store.insert(makeEvent({ id: "2", service: "resend" }));
		const results = store.query({});
		expect(results).toHaveLength(2);
	});

	it("filters by type", () => {
		store.insert(makeEvent({ id: "1", type: "resolution" }));
		store.insert(makeEvent({ id: "2", type: "execution" }));
		const results = store.query({ type: "execution" });
		expect(results).toHaveLength(1);
		expect(results[0]?.type).toBe("execution");
	});

	it("filters by service", () => {
		store.insert(makeEvent({ id: "1", service: "stripe" }));
		store.insert(makeEvent({ id: "2", service: "resend" }));
		const results = store.query({ service: "resend" });
		expect(results).toHaveLength(1);
		expect(results[0]?.service).toBe("resend");
	});

	it("filters by success", () => {
		store.insert(makeEvent({ id: "1", success: true }));
		store.insert(makeEvent({ id: "2", success: false }));
		const results = store.query({ success: false });
		expect(results).toHaveLength(1);
		expect(results[0]?.success).toBe(false);
	});

	it("filters by time range", () => {
		store.insert(makeEvent({ id: "1", timestamp: "2026-04-01T00:00:00Z" }));
		store.insert(makeEvent({ id: "2", timestamp: "2026-04-02T00:00:00Z" }));
		store.insert(makeEvent({ id: "3", timestamp: "2026-04-03T00:00:00Z" }));
		const results = store.query({
			since: "2026-04-02T00:00:00Z",
			until: "2026-04-02T23:59:59Z",
		});
		expect(results).toHaveLength(1);
	});

	it("respects limit", () => {
		for (let i = 0; i < 20; i++) {
			store.insert(makeEvent({ id: `e${i}` }));
		}
		const results = store.query({ limit: 5 });
		expect(results).toHaveLength(5);
	});

	it("preserves metadata", () => {
		store.insert(
			makeEvent({ id: "1", metadata: { provider: "resend", cost: 0.01 } }),
		);
		const results = store.query({});
		expect(results[0]?.metadata).toEqual({ provider: "resend", cost: 0.01 });
	});

	it("handles null metadata", () => {
		store.insert(makeEvent({ id: "1", metadata: undefined }));
		const results = store.query({});
		expect(results[0]?.metadata).toBeUndefined();
	});

	it("computes topIntents", () => {
		store.insert(
			makeEvent({ id: "1", service: "stripe", intentId: "create_charge" }),
		);
		store.insert(
			makeEvent({ id: "2", service: "stripe", intentId: "create_charge" }),
		);
		store.insert(
			makeEvent({ id: "3", service: "resend", intentId: "send_email" }),
		);
		const top = store.topIntents(2);
		expect(top).toHaveLength(2);
		expect(top[0]?.key).toBe("stripe/create_charge");
		expect(top[0]?.count).toBe(2);
	});

	it("computes failureRate", () => {
		store.insert(makeEvent({ id: "1", success: true }));
		store.insert(makeEvent({ id: "2", success: true }));
		store.insert(makeEvent({ id: "3", success: false }));
		expect(store.failureRate()).toBeCloseTo(1 / 3);
	});

	it("computes failureRate by service", () => {
		store.insert(makeEvent({ id: "1", service: "stripe", success: true }));
		store.insert(makeEvent({ id: "2", service: "stripe", success: false }));
		store.insert(makeEvent({ id: "3", service: "resend", success: true }));
		expect(store.failureRate("stripe")).toBeCloseTo(0.5);
		expect(store.failureRate("resend")).toBe(0);
	});

	it("returns 0 failure rate on empty store", () => {
		expect(store.failureRate()).toBe(0);
	});
});
