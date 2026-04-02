import { readFileSync, writeFileSync } from "node:fs";
import type { SpecIndex } from "./types.js";

export function writeIndex(index: SpecIndex, path: string): void {
	writeFileSync(path, JSON.stringify(index, null, 2), "utf-8");
}

export function readIndex(path: string): SpecIndex {
	const raw = readFileSync(path, "utf-8");
	return JSON.parse(raw) as SpecIndex;
}
