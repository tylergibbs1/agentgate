#!/usr/bin/env node

import { parseArgs } from "node:util";
import { Crawler } from "./crawler.js";
import { writeIndex } from "./store.js";

const USAGE = `
  agentgate-crawl — discover and index agents.json files

  Usage:
    agentgate-crawl <domain1> [domain2] ...   Crawl domains for agents.json
    agentgate-crawl --file domains.txt        Crawl domains from a file

  Options:
    --file <path>       Read domains from a file (one per line)
    --output <path>     Output index path (default: ./index.json)
    --concurrency <n>   Parallel requests (default: 3)
    --delay <ms>        Delay between requests (default: 500)
    --help              Show this help
`;

async function main(): Promise<void> {
	const { values, positionals } = parseArgs({
		allowPositionals: true,
		options: {
			file: { type: "string" },
			output: { type: "string", default: "./index.json" },
			concurrency: { type: "string" },
			delay: { type: "string" },
			help: { type: "boolean", short: "h", default: false },
		},
	});

	if (values.help) {
		console.log(USAGE);
		process.exit(0);
	}

	let domains: string[] = positionals;

	if (values.file) {
		const { readFileSync } = await import("node:fs");
		const content = readFileSync(values.file, "utf-8");
		domains = content
			.split("\n")
			.map((l) => l.trim())
			.filter(Boolean);
	}

	if (domains.length === 0) {
		console.error("Error: no domains specified.");
		console.log(USAGE);
		process.exit(1);
	}

	const crawler = new Crawler({
		concurrency: values.concurrency
			? Number.parseInt(values.concurrency)
			: undefined,
		delayMs: values.delay ? Number.parseInt(values.delay) : undefined,
	});

	console.log(`Crawling ${domains.length} domain(s)...\n`);

	const targets = domains.map((d) => ({ domain: d }));
	const results = await crawler.crawl(targets);

	for (const r of results) {
		const icon = r.status === "ok" ? "✓" : r.status === "not_found" ? "—" : "✗";
		console.log(`  ${icon} ${r.domain} [${r.status}]`);
		if (r.errors) {
			for (const e of r.errors) {
				console.log(`    ${e}`);
			}
		}
	}

	const index = crawler.buildIndex(results);
	const output = values.output ?? "./index.json";
	writeIndex(index, output);

	const okCount = results.filter((r) => r.status === "ok").length;
	console.log(`\n  Indexed ${okCount}/${results.length} domain(s) → ${output}`);
}

main();
