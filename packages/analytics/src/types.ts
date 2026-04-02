export interface AnalyticsEvent {
	id: string;
	timestamp: string;
	type: "resolution" | "execution" | "discovery" | "crawl";
	service: string;
	intentId: string;
	input: string;
	success: boolean;
	durationMs: number;
	metadata?: Record<string, unknown>;
}

export interface TrackerOptions {
	/** Path to SQLite database. Use ":memory:" for in-memory. */
	dbPath?: string;
	/** Disable tracking entirely. Default: true. */
	enabled?: boolean;
}

export interface QueryFilter {
	type?: AnalyticsEvent["type"];
	service?: string;
	intentId?: string;
	success?: boolean;
	since?: string;
	until?: string;
	limit?: number;
}

export interface AggregateResult {
	key: string;
	count: number;
}
