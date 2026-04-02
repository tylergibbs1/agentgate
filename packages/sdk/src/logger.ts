export interface LogEntry {
	timestamp: string;
	type: "resolution" | "execution";
	service: string;
	intentId: string;
	input: string;
	request?: {
		method: string;
		url: string;
		body?: unknown;
	};
	response?: {
		status: number;
		durationMs: number;
	};
	error?: string;
}

export interface Logger {
	log(entry: LogEntry): void;
	entries(): readonly LogEntry[];
}

export class MemoryLogger implements Logger {
	private readonly _entries: LogEntry[] = [];

	log(entry: LogEntry): void {
		this._entries.push(entry);
	}

	entries(): readonly LogEntry[] {
		return this._entries;
	}
}
