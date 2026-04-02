import Database from "better-sqlite3";
import type { AggregateResult, AnalyticsEvent, QueryFilter } from "./types.js";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS events (
	id TEXT PRIMARY KEY,
	timestamp TEXT NOT NULL,
	type TEXT NOT NULL,
	service TEXT NOT NULL,
	intent_id TEXT NOT NULL,
	input TEXT NOT NULL,
	success INTEGER NOT NULL,
	duration_ms INTEGER NOT NULL,
	metadata TEXT
);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
CREATE INDEX IF NOT EXISTS idx_events_service ON events(service);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
`;

export class EventStore {
	private readonly db: Database.Database;
	private readonly insertStmt: Database.Statement;

	constructor(dbPath: string) {
		this.db = new Database(dbPath);
		this.db.pragma("journal_mode = WAL");
		this.db.exec(SCHEMA);
		this.insertStmt = this.db.prepare(`
			INSERT INTO events (id, timestamp, type, service, intent_id, input, success, duration_ms, metadata)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		`);
	}

	insert(event: AnalyticsEvent): void {
		this.insertStmt.run(
			event.id,
			event.timestamp,
			event.type,
			event.service,
			event.intentId,
			event.input,
			event.success ? 1 : 0,
			event.durationMs,
			event.metadata ? JSON.stringify(event.metadata) : null,
		);
	}

	query(filter: QueryFilter): AnalyticsEvent[] {
		const conditions: string[] = [];
		const params: unknown[] = [];

		if (filter.type) {
			conditions.push("type = ?");
			params.push(filter.type);
		}
		if (filter.service) {
			conditions.push("service = ?");
			params.push(filter.service);
		}
		if (filter.intentId) {
			conditions.push("intent_id = ?");
			params.push(filter.intentId);
		}
		if (filter.success !== undefined) {
			conditions.push("success = ?");
			params.push(filter.success ? 1 : 0);
		}
		if (filter.since) {
			conditions.push("timestamp >= ?");
			params.push(filter.since);
		}
		if (filter.until) {
			conditions.push("timestamp <= ?");
			params.push(filter.until);
		}

		const where =
			conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
		const limit = filter.limit ? `LIMIT ${filter.limit}` : "";
		const sql = `SELECT * FROM events ${where} ORDER BY timestamp DESC ${limit}`;

		const rows = this.db.prepare(sql).all(...params) as Array<{
			id: string;
			timestamp: string;
			type: string;
			service: string;
			intent_id: string;
			input: string;
			success: number;
			duration_ms: number;
			metadata: string | null;
		}>;

		return rows.map((row) => ({
			id: row.id,
			timestamp: row.timestamp,
			type: row.type as AnalyticsEvent["type"],
			service: row.service,
			intentId: row.intent_id,
			input: row.input,
			success: row.success === 1,
			durationMs: row.duration_ms,
			metadata: row.metadata
				? (JSON.parse(row.metadata) as Record<string, unknown>)
				: undefined,
		}));
	}

	topIntents(limit = 10): AggregateResult[] {
		const rows = this.db
			.prepare(
				`SELECT service || '/' || intent_id AS key, COUNT(*) AS count
				FROM events
				GROUP BY service, intent_id
				ORDER BY count DESC
				LIMIT ?`,
			)
			.all(limit) as Array<{ key: string; count: number }>;
		return rows;
	}

	failureRate(service?: string): number {
		const where = service ? "WHERE service = ?" : "";
		const params = service ? [service] : [];
		const row = this.db
			.prepare(
				`SELECT
					COUNT(*) AS total,
					SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) AS failures
				FROM events ${where}`,
			)
			.get(...params) as { total: number; failures: number } | undefined;

		if (!row || row.total === 0) return 0;
		return row.failures / row.total;
	}

	close(): void {
		this.db.close();
	}
}
