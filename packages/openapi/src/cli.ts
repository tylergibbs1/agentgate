#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { convertOpenAPI } from "./convert.js";
import type { ConvertOptions, OpenAPISpec } from "./types.js";

const USAGE = `
  agentgate-openapi — convert OpenAPI specs to agents.json format

  Usage:
    agentgate-openapi <openapi-file>         Convert from a local file
    agentgate-openapi --url <url>             Convert from a URL
    agentgate-openapi <file> --name stripe    Override service name
    agentgate-openapi <file> --env STRIPE_KEY Set auth env var name
    agentgate-openapi <file> --max 10         Limit to 10 intents
    agentgate-openapi <file> --tags payments  Only include tagged operations

  Options:
    --url <url>         Fetch OpenAPI spec from URL
    --name <name>       Service name (default: from spec title)
    --env <var>         Auth environment variable name
    --max <n>           Max intents to generate (default: 20)
    --tags <t1,t2>      Only include operations with these tags
    --output <file>     Write to file instead of stdout
    --help              Show this help
`;

async function main(): Promise<void> {
	const { values, positionals } = parseArgs({
		allowPositionals: true,
		options: {
			url: { type: "string" },
			name: { type: "string" },
			env: { type: "string" },
			max: { type: "string" },
			tags: { type: "string" },
			output: { type: "string", short: "o" },
			help: { type: "boolean", short: "h", default: false },
		},
	});

	if (values.help || (positionals.length === 0 && !values.url)) {
		console.log(USAGE);
		process.exit(0);
	}

	let raw: string;
	if (values.url) {
		const res = await fetch(values.url);
		raw = await res.text();
	} else {
		raw = readFileSync(positionals[0]!, "utf-8");
	}

	const openapi = JSON.parse(raw) as OpenAPISpec;

	const options: ConvertOptions = {
		serviceName: values.name,
		envVar: values.env,
		maxIntents: values.max ? Number.parseInt(values.max) : undefined,
		tags: values.tags?.split(","),
	};

	const agentSpec = convertOpenAPI(openapi, options);
	const output = JSON.stringify(agentSpec, null, "\t");

	if (values.output) {
		const { writeFileSync } = await import("node:fs");
		writeFileSync(values.output, output, "utf-8");
		console.error(
			`Wrote ${agentSpec.intents.length} intents for "${agentSpec.service.name}" → ${values.output}`,
		);
	} else {
		console.log(output);
	}
}

main();
