import { randomUUID } from "node:crypto";
import { EventStore } from "./store.js";
import type {
	AggregateResult,
	AnalyticsEvent,
	QueryFilter,
	TrackerOptions,
} from "./types.js";

const DEFAULT_DB_PATH = ":memory:";

export class Tracker {
	private readonly store: EventStore | null;

	constructor(options?: TrackerOptions) {
		if (options?.enabled === false) {
			this.store = null;
			return;
		}
		this.store = new EventStore(options?.dbPath ?? DEFAULT_DB_PATH);
	}

	track(
		event: Omit<AnalyticsEvent, "id" | "timestamp"> & {
			id?: string;
			timestamp?: string;
		},
	): void {
		if (!this.store) return;
		this.store.insert({
			id: event.id ?? randomUUID(),
			timestamp: event.timestamp ?? new Date().toISOString(),
			...event,
		} as AnalyticsEvent);
	}

	query(filter: QueryFilter): AnalyticsEvent[] {
		if (!this.store) return [];
		return this.store.query(filter);
	}

	topIntents(limit?: number): AggregateResult[] {
		if (!this.store) return [];
		return this.store.topIntents(limit);
	}

	failureRate(service?: string): number {
		if (!this.store) return 0;
		return this.store.failureRate(service);
	}

	close(): void {
		this.store?.close();
	}
}
