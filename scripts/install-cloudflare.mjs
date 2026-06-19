#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const WEB_WORKER_BASE_NAME = "openmail";
const EMAIL_WORKER_BASE_NAME = "openmail-email";
const D1_DATABASE_BASE_NAME = "mail-db";
const R2_BUCKET_BASE_NAME = "mail-raw";
const WEB_CONFIG = "wrangler.jsonc";
const EMAIL_CONFIG = "wrangler.email.jsonc";
const WEB_SECRETS = [
	"BETTER_AUTH_SECRET",
	"BETTER_AUTH_URL",
	"ADMIN_EMAIL",
	"EMAIL_PASSWORD_LOGIN_ENABLED",
	"AUTH_RESEND_API_KEY",
	"AUTH_RESEND_FROM",
	"GOOGLE_CLIENT_ID",
	"GOOGLE_CLIENT_SECRET",
	"GITHUB_CLIENT_ID",
	"GITHUB_CLIENT_SECRET",
];
const EMAIL_WORKER_SECRETS = [
	"CLOUDFLARE_AI_ACCOUNT_ID",
	"CLOUDFLARE_AI_API_TOKEN",
];

function parseArgs(argv) {
	const options = {
		envFile: ".env.prod",
		yes: false,
		dryRun: false,
		skipDeploy: false,
		disableDns: false,
		prefix: "",
		selfTestParsers: false,
	};

	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i];
		if (arg === "--") {
			continue;
		}
		if (arg === "--env-file") {
			const value = argv[i + 1];
			if (!value) throw new Error("--env-file requires a path.");
			options.envFile = value;
			i += 1;
			continue;
		}
		if (arg === "--prefix") {
			const value = argv[i + 1];
			if (!value) throw new Error("--prefix requires a value.");
			options.prefix = normalizePrefix(value);
			i += 1;
			continue;
		}
		if (arg === "--yes" || arg === "-y") {
			options.yes = true;
			continue;
		}
		if (arg === "--dry-run") {
			options.dryRun = true;
			continue;
		}
		if (arg === "--disable-dns") {
			options.disableDns = true;
			continue;
		}
		if (arg === "--self-test-parsers") {
			options.selfTestParsers = true;
			continue;
		}
		if (arg === "--skip-deploy") {
			options.skipDeploy = true;
			continue;
		}
		if (arg === "--help" || arg === "-h") {
			printHelp();
			process.exit(0);
		}
		throw new Error(`Unknown option: ${arg}`);
	}

	return options;
}

function printHelp() {
	console.log(`OpenMail Cloudflare installer

Usage:
  pnpm install:cloudflare [--yes] [--skip-deploy] [--prefix demo] [--env-file .env.prod]
  pnpm install:cloudflare:dry-run

Options:
  --env-file <path>  Env file to read. Defaults to .env.prod.
  --prefix <value>   Prefix Cloudflare resource names, e.g. demo-openmail.
  --disable-dns      Do not configure the web Worker custom domain route.
  --yes, -y          Skip confirmation prompts.
  --skip-deploy      Prepare resources, migrations, and secrets without deploying.
  --dry-run          Validate and print planned actions without changing anything.
`);
}

function normalizePrefix(prefix) {
	const trimmed = prefix.trim().toLowerCase().replace(/^-+|-+$/g, "");
	if (!trimmed) return "";
	if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(trimmed)) {
		throw new Error("--prefix may contain only lowercase letters, numbers, and hyphens, and cannot start or end with a hyphen.");
	}
	return trimmed;
}

function withPrefix(prefix, name) {
	return prefix ? `${prefix}-${name}` : name;
}

function getResourceNames(options) {
	return {
		webWorker: withPrefix(options.prefix, WEB_WORKER_BASE_NAME),
		emailWorker: withPrefix(options.prefix, EMAIL_WORKER_BASE_NAME),
		d1Database: withPrefix(options.prefix, D1_DATABASE_BASE_NAME),
		r2Bucket: withPrefix(options.prefix, R2_BUCKET_BASE_NAME),
	};
}

function readEnvFile(envFile) {
	const path = resolve(envFile);
	if (!existsSync(path)) {
		throw new Error(`Missing ${envFile}. Create it from .env.example and fill production values.`);
	}
	return parseEnv(readFileSync(path, "utf8"));
}

function parseEnv(contents) {
	const env = {};
	for (const rawLine of contents.split(/\r?\n/)) {
		const line = rawLine.trim();
		if (!line || line.startsWith("#")) continue;
		const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
		if (!match) continue;
		const [, key, rawValue] = match;
		let value = rawValue.trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		} else {
			value = value.replace(/(?:^|\s+)#.*$/, "").trim();
		}
		env[key] = value;
	}
	return env;
}

function present(value) {
	return typeof value === "string" && value.trim().length > 0;
}

function validateEnv(env) {
	const errors = [];
	for (const key of ["BETTER_AUTH_SECRET", "BETTER_AUTH_URL", "ADMIN_EMAIL"]) {
		if (!present(env[key])) errors.push(`${key} is required.`);
	}

	const pairs = [
		["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "Google OAuth"],
		["GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET", "GitHub OAuth"],
		["CLOUDFLARE_AI_ACCOUNT_ID", "CLOUDFLARE_AI_API_TOKEN", "Cloudflare AI classification"],
	];

	for (const [left, right, label] of pairs) {
		if (present(env[left]) !== present(env[right])) {
			errors.push(`${label} requires both ${left} and ${right}, or neither.`);
		}
	}

	if (present(env.BETTER_AUTH_URL)) {
		try {
			new URL(env.BETTER_AUTH_URL);
		} catch {
			errors.push("BETTER_AUTH_URL must be a full URL such as https://mail.example.com.");
		}
	}

	return errors;
}

function getBetterAuthHostname(env) {
	if (!present(env.BETTER_AUTH_URL)) return null;
	try {
		return new URL(env.BETTER_AUTH_URL).hostname;
	} catch {
		return null;
	}
}

function mask(value) {
	if (!present(value)) return "(not set)";
	const trimmed = value.trim();
	if (trimmed.length <= 8) return "********";
	return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}

function enabledPair(env, left, right) {
	return present(env[left]) && present(env[right]);
}

function printSummary(env, options) {
	const names = getResourceNames(options);
	console.log("\nOpenMail Cloudflare install summary");
	console.log("-----------------------------------");
	console.log(`Env file: ${options.envFile}`);
	console.log(`Mode: ${options.dryRun ? "dry run" : "live"}`);
	console.log(`Deploy after setup: ${options.skipDeploy ? "no" : "yes"}`);
	console.log(`Prefix: ${options.prefix || "(none)"}`);
	console.log(`Web worker: ${names.webWorker}`);
	console.log(`Email worker: ${names.emailWorker}`);
	console.log(`D1 database: ${names.d1Database}`);
	console.log(`R2 bucket: ${names.r2Bucket}`);
	console.log(`BETTER_AUTH_URL: ${env.BETTER_AUTH_URL}`);
	console.log(`Web custom domain: ${options.disableDns ? "disabled" : getBetterAuthHostname(env)}`);
	console.log(`ADMIN_EMAIL: ${env.ADMIN_EMAIL}`);
	console.log(`BETTER_AUTH_SECRET: ${mask(env.BETTER_AUTH_SECRET)}`);
	console.log(`Email/password login: ${env.EMAIL_PASSWORD_LOGIN_ENABLED || "(not set)"}`);
	console.log(`Resend verification: ${present(env.AUTH_RESEND_API_KEY) ? "enabled" : "disabled"}`);
	console.log(`Google OAuth: ${enabledPair(env, "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET") ? "enabled" : "disabled"}`);
	console.log(`GitHub OAuth: ${enabledPair(env, "GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET") ? "enabled" : "disabled"}`);
	console.log(`Cloudflare AI classification: ${enabledPair(env, "CLOUDFLARE_AI_ACCOUNT_ID", "CLOUDFLARE_AI_API_TOKEN") ? "enabled" : "disabled"}`);
	console.log("");
}

async function confirmUnlessYes(options, message) {
	if (options.yes || options.dryRun) return;
	const rl = createInterface({ input, output });
	try {
		const answer = await rl.question(`${message} Type "yes" to continue: `);
		if (answer.trim().toLowerCase() !== "yes") {
			throw new Error("Installer cancelled.");
		}
	} finally {
		rl.close();
	}
}

function run(command, args, options = {}) {
	const pretty = [command, ...args].join(" ");
	console.log(`\n$ ${pretty}`);
	const result = spawnSync(command, args, {
		cwd: process.cwd(),
		encoding: "utf8",
		stdio: options.input ? ["pipe", "pipe", "pipe"] : "pipe",
		input: options.input,
		env: {
			...process.env,
		},
	});

	if (options.printStdout !== false && result.stdout?.trim()) {
		console.log(result.stdout.trim());
	}
	if (result.status !== 0) {
		if (result.stderr?.trim()) console.error(result.stderr.trim());
		throw new Error(`Command failed: ${pretty}`);
	}
	if (options.includeStderr) {
		return `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
	}
	return result.stdout ?? "";
}

async function runInteractive(command, args) {
	const pretty = [command, ...args].join(" ");
	console.log(`\n$ ${pretty}`);
	await new Promise((resolvePromise, reject) => {
		const child = spawn(command, args, {
			cwd: process.cwd(),
			stdio: "inherit",
			env: {
				...process.env,
			},
		});
		child.on("close", (code) => {
			if (code === 0) resolvePromise();
			else reject(new Error(`Command failed: ${pretty}`));
		});
		child.on("error", reject);
	});
}

function ensurePnpmAvailable() {
	const result = spawnSync("pnpm", ["--version"], { encoding: "utf8", stdio: "pipe" });
	if (result.status !== 0) {
		throw new Error("pnpm is required. Install pnpm, then run this installer again.");
	}
}

function ensureWranglerInstalled(options) {
	if (options.dryRun) {
		console.log("Dry run: skipping Wrangler installation check.");
		return;
	}
	ensurePnpmAvailable();
	if (existsSync(resolve("node_modules/.bin/wrangler"))) {
		console.log("Wrangler found in node_modules.");
		return;
	}
	console.log("Wrangler is missing from node_modules. Installing project dependencies...");
	run("pnpm", ["install"]);
}

async function ensureLogin(options) {
	if (options.dryRun) {
		console.log("Dry run: skipping Cloudflare login check.");
		return;
	}
	const whoami = spawnSync("pnpm", ["exec", "wrangler", "whoami", "--json"], {
		cwd: process.cwd(),
		encoding: "utf8",
		stdio: "pipe",
		env: {
			...process.env,
		},
	});
	const jsonWhoami = JSON.parse(whoami.stdout);
	if (whoami.status === 0 && jsonWhoami.loggedIn) {
		console.log("Cloudflare login detected.");
		return;
	}

	console.log("Cloudflare login is required.");
	await runInteractive("pnpm", ["exec", "wrangler", "login"]);
	const retry = spawnSync("pnpm", ["exec", "wrangler", "whoami", "--json"], {
		cwd: process.cwd(),
		encoding: "utf8",
		stdio: "pipe",
		env: {
			...process.env,
		},
	});
	const jsonRetryWhoami = JSON.parse(retry.stdout);
	if (retry.status !== 0 || !jsonRetryWhoami.loggedIn) {
		throw new Error("Cloudflare login failed. Run `pnpm exec wrangler login` manually and try again.");
	}
}

function parseJsonOutput(outputText, commandName) {
	const jsonText = extractJsonPayload(outputText);
	if (!jsonText) {
		const preview = outputText.trim().slice(0, 500) || "(empty stdout)";
		throw new Error(`Could not find JSON output from ${commandName}. Output started with: ${preview}`);
	}
	try {
		return JSON.parse(jsonText);
	} catch {
		const preview = jsonText.slice(0, 500);
		throw new Error(`Could not parse JSON output from ${commandName}. JSON started with: ${preview}`);
	}
}

function extractJsonPayload(outputText) {
	for (let index = 0; index < outputText.length; index += 1) {
		const char = outputText[index];
		if (char !== "{" && char !== "[") continue;

		const end = findBalancedJsonEnd(outputText, index);
		if (end === -1) continue;

		return outputText.slice(index, end + 1);
	}
	return null;
}

function findBalancedJsonEnd(text, startIndex) {
	const stack = [];
	let inString = false;
	let escaped = false;

	for (let index = startIndex; index < text.length; index += 1) {
		const char = text[index];

		if (inString) {
			if (escaped) {
				escaped = false;
			} else if (char === "\\") {
				escaped = true;
			} else if (char === "\"") {
				inString = false;
			}
			continue;
		}

		if (char === "\"") {
			inString = true;
			continue;
		}
		if (char === "{" || char === "[") {
			stack.push(char);
			continue;
		}
		if (char === "}" || char === "]") {
			const expected = char === "}" ? "{" : "[";
			if (stack.pop() !== expected) return -1;
			if (stack.length === 0) return index;
		}
	}

	return -1;
}

function findD1Id(databases, name) {
	const list = Array.isArray(databases) ? databases : databases.result;
	const match = list?.find((db) => db.name === name || db.database_name === name);
	return match?.uuid || match?.id || match?.database_id;
}

function findD1IdInCreateOutput(outputText) {
	const match =
		outputText.match(/database_id\s*=\s*"([^"]+)"/) ??
		outputText.match(/"database_id"\s*:\s*"([^"]+)"/) ??
		outputText.match(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i);
	return match?.[1] ?? match?.[0] ?? null;
}

function getExistingD1Id(databaseName) {
	const result = spawnSync("pnpm", ["exec", "wrangler", "d1", "info", databaseName, "--json"], {
		cwd: process.cwd(),
		encoding: "utf8",
		stdio: "pipe",
		env: {
			...process.env,
		},
	});
	if (result.status !== 0) return null;
	const outputText = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
	if (!outputText.trim()) return null;
	const info = parseJsonOutput(outputText, "wrangler d1 info");
	return info.uuid || info.id || info.database_id || null;
}

function ensureD1Database(resourceNames, options) {
	if (options.dryRun) {
		console.log(`Dry run: would create or reuse D1 database ${resourceNames.d1Database}.`);
		return "dry-run-d1-id";
	}

	let databaseId = getExistingD1Id(resourceNames.d1Database);
	if (databaseId) {
		console.log(`Reusing D1 database ${resourceNames.d1Database}.`);
		return databaseId;
	}

	const createOutput = run("pnpm", ["exec", "wrangler", "d1", "create", resourceNames.d1Database]);
	databaseId = findD1IdInCreateOutput(createOutput);
	if (databaseId) {
		return databaseId;
	}

	databaseId = getExistingD1Id(resourceNames.d1Database);
	if (!databaseId) {
		throw new Error(`Created ${resourceNames.d1Database}, but could not find its database_id.`);
	}
	return databaseId;
}

function r2BucketExists(bucketName) {
	const result = spawnSync("pnpm", ["exec", "wrangler", "r2", "bucket", "info", bucketName, "--json"], {
		cwd: process.cwd(),
		encoding: "utf8",
		stdio: "pipe",
		env: {
			...process.env,
		},
	});
	return result.status === 0;
}

function ensureR2Bucket(resourceNames, options) {
	if (options.dryRun) {
		console.log(`Dry run: would create or reuse R2 bucket ${resourceNames.r2Bucket}.`);
		return;
	}

	if (r2BucketExists(resourceNames.r2Bucket)) {
		console.log(`Reusing R2 bucket ${resourceNames.r2Bucket}.`);
		return;
	}

	run("pnpm", ["exec", "wrangler", "r2", "bucket", "create", resourceNames.r2Bucket]);
}

function replaceJsoncStringProperty(block, key, value) {
	const pattern = new RegExp(`("${key}"\\s*:\\s*)"[^"]*"`);
	if (!pattern.test(block)) {
		throw new Error(`Could not find ${key} in Wrangler config block.`);
	}
	return block.replace(pattern, `$1"${value}"`);
}

function removeTopLevelRoutes(configText) {
	return configText.replace(/\n\t"routes"\s*:\s*\[[\s\S]*?\],(?=\n\t")/, "");
}

function setWebCustomDomainRoute(configText, hostname) {
	const routesBlock = `\n\t"routes": [\n\t\t{\n\t\t\t"pattern": "${hostname}",\n\t\t\t"custom_domain": true\n\t\t}\n\t],`;
	const withoutRoutes = removeTopLevelRoutes(configText);
	return withoutRoutes.replace(/\n\t"d1_databases"\s*:/, `${routesBlock}\n\t"d1_databases":`);
}

function patchWranglerConfig(filePath, databaseId, resourceNames, env, options) {
	const original = readFileSync(filePath, "utf8");
	const workerName = filePath === WEB_CONFIG ? resourceNames.webWorker : resourceNames.emailWorker;
	let next = original.replace(
		/^(\s*"name"\s*:\s*)"[^"]*"/m,
		`$1"${workerName}"`
	);
	if (filePath === WEB_CONFIG) {
		next = next.replace(
			/("service"\s*:\s*)"[^"]*"/,
			`$1"${resourceNames.webWorker}"`
		);
		next = options.disableDns
			? removeTopLevelRoutes(next)
			: setWebCustomDomainRoute(next, getBetterAuthHostname(env));
	}
	next = next.replace(
		/("d1_databases"\s*:\s*\[\s*\{[\s\S]*?\}\s*\])/,
		(match) => {
			let block = replaceJsoncStringProperty(match, "database_name", resourceNames.d1Database);
			block = replaceJsoncStringProperty(block, "database_id", databaseId);
			return block;
		}
	);
	next = next.replace(
		/("r2_buckets"\s*:\s*\[\s*\{[\s\S]*?\}\s*\])/,
		(match) => replaceJsoncStringProperty(match, "bucket_name", resourceNames.r2Bucket)
	);

	if (next === original) {
		console.log(`${filePath} already points at ${workerName}, ${resourceNames.d1Database}, and ${resourceNames.r2Bucket}.`);
		return;
	}
	if (options.dryRun) {
		console.log(`Dry run: would patch ${filePath}.`);
		return;
	}
	writeFileSync(filePath, next);
	console.log(`Patched ${filePath}.`);
}

function applyMigrations(resourceNames, options) {
	if (options.dryRun) {
		console.log(`Dry run: would apply D1 migrations to ${resourceNames.d1Database}.`);
		return;
	}
	run("pnpm", ["exec", "wrangler", "d1", "migrations", "apply", resourceNames.d1Database, "--remote"]);
}

function selectedSecrets(env, keys) {
	return keys
		.filter((key) => present(env[key]))
		.map((key) => [key, env[key].trim()]);
}

function putSecret(configFile, key, value, options) {
	if (options.dryRun) {
		console.log(`Dry run: would set ${key} on ${configFile}.`);
		return;
	}
	run("pnpm", ["exec", "wrangler", "secret", "put", key, "--config", configFile], {
		input: `${value}\n`,
		printStdout: false,
	});
	console.log(`Set ${key} on ${configFile}.`);
}

function uploadSecrets(env, options) {
	const webSecrets = selectedSecrets(env, WEB_SECRETS);
	const emailSecrets = selectedSecrets(env, EMAIL_WORKER_SECRETS);

	for (const [key, value] of webSecrets) {
		putSecret(WEB_CONFIG, key, value, options);
	}
	for (const [key, value] of emailSecrets) {
		putSecret(EMAIL_CONFIG, key, value, options);
	}
	if (emailSecrets.length === 0) {
		console.log("Cloudflare AI secrets not provided; skipping email worker AI secrets.");
	}
}

function deployWorkers(options) {
	if (options.skipDeploy) {
		console.log("Skipping deploy because --skip-deploy was set.");
		return;
	}
	if (options.dryRun) {
		console.log("Dry run: would deploy web and email workers.");
		return;
	}
	run("pnpm", ["worker:deploy"]);
	run("pnpm", ["email-worker:deploy"]);
}

function printCompletion(env, resourceNames, options) {
	const webUrl = env.BETTER_AUTH_URL?.trim();
	console.log(options.dryRun ? "\nOpenMail Cloudflare dry run complete." : "\nOpenMail Cloudflare install complete.");
	console.log(`Web worker: ${resourceNames.webWorker}`);
	console.log(`Email worker: ${resourceNames.emailWorker}`);
	console.log(`D1 database: ${resourceNames.d1Database}`);
	console.log(`R2 bucket: ${resourceNames.r2Bucket}`);
	if (options.skipDeploy) {
		console.log("Deploy skipped. Run `pnpm worker:deploy` and `pnpm email-worker:deploy` when you are ready.");
	} else {
		console.log("Next: configure Cloudflare Email Routing to send mail to the email worker.");
	}
	console.log("Deployment guide: docs/deployment.md");
	console.log("Usage guide: docs/usage.md");
	if (webUrl) {
		console.log(`\x1b[32m${options.dryRun ? "Planned web app" : "Web app"}: ${webUrl}\x1b[0m`);
	}
}

async function main() {
	const options = parseArgs(process.argv.slice(2));
	if (options.selfTestParsers) {
		selfTestParsers();
		return;
	}
	const env = readEnvFile(options.envFile);
	const resourceNames = getResourceNames(options);
	const errors = validateEnv(env);
	printSummary(env, options);
	if (errors.length > 0) {
		for (const error of errors) console.error(`- ${error}`);
		throw new Error("Fix the environment file and run the installer again.");
	}

	ensureWranglerInstalled(options);
	await ensureLogin(options);
	await confirmUnlessYes(options, "This will create/reuse Cloudflare resources, patch Wrangler configs, set secrets, apply migrations, and deploy.");
	const databaseId = ensureD1Database(resourceNames, options);
	ensureR2Bucket(resourceNames, options);
	patchWranglerConfig(WEB_CONFIG, databaseId, resourceNames, env, options);
	patchWranglerConfig(EMAIL_CONFIG, databaseId, resourceNames, env, options);
	applyMigrations(resourceNames, options);
	uploadSecrets(env, options);
	deployWorkers(options);
	printCompletion(env, resourceNames, options);
}

function selfTestParsers() {
	const d1Json = `[
  {
    "uuid": "011add5d-4bfd-4e2e-bcb9-7d4d50ecdddd",
    "name": "test-mail-db"
	},
  {
    "uuid": "5e306c11-67a9-4449-b6d0-e5fabbd09999",
    "name": "mail-db"
  }
]`;
	const noisyOutput = `warning before json\n${d1Json}\nlogs after json`;
	const parsed = parseJsonOutput(noisyOutput, "parser self-test");
	if (!Array.isArray(parsed) || parsed.length !== 2) {
		throw new Error("JSON extraction self-test failed.");
	}
	const createOutput = `database_id = "011add5d-4bfd-4e2e-bcb9-7d4d50ecdddd"`;
	if (findD1IdInCreateOutput(createOutput) !== "011add5d-4bfd-4e2e-bcb9-7d4d50ecdddd") {
		throw new Error("D1 create parser self-test failed.");
	}
	console.log("Parser self-test passed.");
}

main().catch((error) => {
	console.error(`\nInstall failed: ${error instanceof Error ? error.message : String(error)}`);
	process.exit(1);
});
