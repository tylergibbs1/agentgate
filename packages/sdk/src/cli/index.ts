#!/usr/bin/env node

import { parseArgs } from "node:util";
import { runDiscover } from "./discover.js";
import { runList } from "./list.js";
import { runIntent } from "./run.js";
import { loadSpecs } from "./util.js";
import { runValidate } from "./validate.js";

const USAGE = `
  agentgate — resolve natural language intents to API calls

  Usage:
    agentgate discover <query>        Search for matching API capabilities
    agentgate validate <file>         Validate an agents.json spec file
    agentgate run <intent> [--dry-run] Resolve and execute an intent
    agentgate list                    List all loaded services and intents

  Options:
    --specs-dir <path>  Path to specs directory (default: ./specs)
    --dry-run           Show what would execute without calling the API
    --help              Show this help message
`;

function main(): void {
	const { values, positionals } = parseArgs({
		allowPositionals: true,
		options: {
			"specs-dir": { type: "string" },
			"dry-run": { type: "boolean", default: false },
			help: { type: "boolean", short: "h", default: false },
		},
	});

	if (values.help || positionals.length === 0) {
		console.log(USAGE);
		process.exit(0);
	}

	const command = positionals[0];
	const args = positionals.slice(1);

	switch (command) {
		case "validate": {
			const file = args[0];
			if (!file) {
				console.error("Error: validate requires a file path argument.");
				process.exit(1);
			}
			runValidate(file);
			break;
		}

		case "discover": {
			const query = args.join(" ");
			if (!query) {
				console.error("Error: discover requires a search query.");
				process.exit(1);
			}
			const specs = loadSpecs(values["specs-dir"]);
			runDiscover(query, specs);
			break;
		}

		case "run": {
			const intent = args.join(" ");
			if (!intent) {
				console.error("Error: run requires an intent string.");
				process.exit(1);
			}
			const specs = loadSpecs(values["specs-dir"]);
			runIntent(intent, specs, values["dry-run"] ?? false);
			break;
		}

		case "list": {
			const specs = loadSpecs(values["specs-dir"]);
			runList(specs);
			break;
		}

		default:
			console.error(`Unknown command: ${command}`);
			console.log(USAGE);
			process.exit(1);
	}
}

main();
