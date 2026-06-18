import { eq } from "drizzle-orm";
import { cache } from "react";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { systemSettings } from "@/lib/schema";

export const GLOBAL_SYSTEM_SETTINGS_ID = "global";
export const CURRENT_SYSTEM_SETTINGS_VERSION = 2;

export const MailProviderSchema = z.enum(["smtp", "resend", "local"]);
export type MailProvider = z.infer<typeof MailProviderSchema>;

const DEFAULT_SMTP_PORT = 587;
const DEFAULT_LOCAL_WORKER_URL = "http://127.0.0.1:8787";

/** Normalize optional text fields so empty form/env values do not overwrite real settings. */
const trimToUndefined = (value: string | undefined) => {
	if (value === undefined) return undefined;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
};

const textSchema = z.preprocess(
	(value) => (typeof value === "string" ? value : ""),
	z.string()
);

const optionalTextSchema = z.preprocess(
	(value) => (typeof value === "string" ? value : undefined),
	z.string().optional()
).transform(trimToUndefined);

const smtpPortSchema = z.preprocess(
	(value) => (value === undefined || value === null || value === "" ? DEFAULT_SMTP_PORT : value),
	z.coerce.number().int().min(1).max(65535)
).catch(DEFAULT_SMTP_PORT);

const booleanLikeSchema = z.preprocess(
	(value) => (value === undefined || value === null || value === "" ? false : value),
	z.union([z.string(), z.boolean()])
).transform((value) => value === true || value === "true").catch(false);

const smtpSettingsSchema = z.object({
	host: z.string(),
	port: z.number().int().min(1).max(65535),
	secure: z.boolean(),
	user: z.string(),
	pass: z.string(),
});

const resendSettingsSchema = z.object({
	apiKey: z.string(),
});

const localSettingsSchema = z.object({
	baseUrl: z.string().optional(),
});

const emailDomainSchema = z
	.string()
	.trim()
	.toLowerCase()
	.transform((domain) => domain.replace(/^@+/, ""))
	.refine(
		(domain) =>
			/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(
				domain
			),
		"Enter a valid email domain."
	);

/** Normalize admin-entered receiving domains into unique domain suffixes. */
export function normalizeEmailDomains(input: string | string[] | undefined) {
	const rawValues = Array.isArray(input) ? input : input?.split(/[\n,]+/) ?? [];
	const domains: string[] = [];
	for (const value of rawValues) {
		const result = emailDomainSchema.safeParse(value);
		if (result.success) {
			domains.push(result.data);
		}
	}

	return Array.from(new Set(domains));
}

export const SystemSettingsV1Schema = z.object({
	mail: z.object({
		provider: MailProviderSchema,
		smtp: smtpSettingsSchema,
		resend: resendSettingsSchema,
		local: localSettingsSchema,
		emailDomains: z.array(emailDomainSchema),
	}),
});

export type SystemSettingsV1 = z.infer<typeof SystemSettingsV1Schema>;

export const DEFAULT_SYSTEM_SETTINGS_V1: SystemSettingsV1 = {
	mail: {
		provider: "smtp",
		smtp: {
			host: "",
			port: DEFAULT_SMTP_PORT,
			secure: false,
			user: "",
			pass: "",
		},
		resend: {
			apiKey: "",
		},
		local: {
			baseUrl: DEFAULT_LOCAL_WORKER_URL,
		},
		emailDomains: [],
	},
};

type MigratedSystemSettings = {
	settings: SystemSettingsV1;
	schemaVersion: number;
	migrated: boolean;
};

type SystemSettingsMigrator = (payload: unknown) => unknown;

const SYSTEM_SETTINGS_MIGRATORS: Partial<Record<number, SystemSettingsMigrator>> = {
	1: (payload) => {
		const existingPayload = z
			.object({
				mail: z.object({}).passthrough(),
			})
			.passthrough()
			.parse(payload);

		return {
			...existingPayload,
			mail: {
				...existingPayload.mail,
				emailDomains: [],
			},
		};
	},
};

const storedSettingsRowSchema = z.object({
	schemaVersion: z.number().int().min(1),
	payload: z.string(),
});

const systemSettingsFormSchema = z
	.object({
		provider: textSchema.pipe(MailProviderSchema),
		smtp_host: textSchema,
		smtp_port: smtpPortSchema,
		smtp_secure: booleanLikeSchema,
		smtp_user: textSchema,
		smtp_pass: textSchema,
		resend_api_key: textSchema,
		local_base_url: optionalTextSchema,
	})
	.transform((form): SystemSettingsV1 => ({
		mail: {
			provider: form.provider,
			smtp: {
				host: form.smtp_host,
				port: form.smtp_port,
				secure: form.smtp_secure,
				user: form.smtp_user,
				pass: form.smtp_pass,
			},
			resend: {
				apiKey: form.resend_api_key,
			},
			local: {
				baseUrl: form.local_base_url,
			},
			emailDomains: [],
		},
	}))
	.superRefine((settings, ctx) => {
		if (!isLocalProviderAllowed() && settings.mail.provider === "local") {
			ctx.addIssue({
				code: "custom",
				path: ["mail", "provider"],
				message: "Local provider is only available in development mode.",
			});
		}
	});

const emailDomainsFormSchema = z
	.object({
		email_domains: textSchema,
	})
	.superRefine((form, ctx) => {
		const rawEmailDomains = form.email_domains.trim();
		if (rawEmailDomains && normalizeEmailDomains(form.email_domains).length === 0) {
			ctx.addIssue({
				code: "custom",
				path: ["email_domains"],
				message: "Enter at least one valid email domain.",
			});
		}
	})
	.transform((form) => normalizeEmailDomains(form.email_domains));

/** Check whether the local worker mail provider can be selected. */
function isLocalProviderAllowed() {
	return process.env.NODE_ENV === "development";
}

/** Run versioned payload migrations before validating the latest settings schema. */
function migrateStoredPayload(payload: unknown, fromVersion: number): MigratedSystemSettings {
	if (fromVersion > CURRENT_SYSTEM_SETTINGS_VERSION) {
		throw new Error(`Unsupported system settings version ${fromVersion}`);
	}

	let nextPayload = payload;
	let version = fromVersion;

	while (version < CURRENT_SYSTEM_SETTINGS_VERSION) {
		const migrator = SYSTEM_SETTINGS_MIGRATORS[version];
		if (!migrator) {
			throw new Error(`Missing system settings migrator for version ${version}`);
		}

		nextPayload = migrator(nextPayload);
		version += 1;
	}

	return {
		settings: SystemSettingsV1Schema.parse(nextPayload),
		schemaVersion: version,
		migrated: version !== fromVersion,
	};
}

/** Parse a system_settings row from its JSON payload into typed settings. */
function parseStoredSettingsRow(row: unknown): MigratedSystemSettings {
	const storedRow = storedSettingsRowSchema.parse(row);
	let payload: unknown;

	try {
		payload = JSON.parse(storedRow.payload);
	} catch {
		throw new Error("system_settings payload must be valid JSON");
	}

	return migrateStoredPayload(payload, storedRow.schemaVersion);
}

/** Persist a migrated settings payload so future reads stay simple. */
async function persistMigratedSettings(migrated: MigratedSystemSettings) {
	const db = getDb();
	await db
		.update(systemSettings)
		.set({
			schemaVersion: migrated.schemaVersion,
			payload: JSON.stringify(migrated.settings),
			updatedAt: new Date().toISOString(),
		})
		.where(eq(systemSettings.id, GLOBAL_SYSTEM_SETTINGS_ID))
		.run();
}

/** Parse a v1 system settings payload without throwing. */
export function parseSystemSettingsV1(payload: unknown): SystemSettingsV1 | null {
	const parsed = SystemSettingsV1Schema.safeParse(payload);
	return parsed.success ? parsed.data : null;
}

/** Convert settings form data into the canonical v1 system settings shape. */
export function parseSystemSettingsV1FormData(formData: FormData): SystemSettingsV1 {
	return systemSettingsFormSchema.parse(Object.fromEntries(formData.entries()));
}

/** Convert domain settings form data into normalized email domains. */
export function parseEmailDomainsFormData(formData: FormData): string[] {
	return emailDomainsFormSchema.parse(Object.fromEntries(formData.entries()));
}

/** Upgrade a stored settings payload to the latest supported version. */
export function migrateSystemSettingsToLatest(payload: unknown, fromVersion: number): {
	payload: SystemSettingsV1;
	version: number;
} {
	const migrated = migrateStoredPayload(payload, fromVersion);
	return {
		payload: migrated.settings,
		version: migrated.schemaVersion,
	};
}

/** Load the stored system settings once per server request/render pass. */
const getCachedSystemSettings = cache(async (): Promise<SystemSettingsV1 | null> => {
	try {
		const db = getDb();
		const rows = await db
			.select()
			.from(systemSettings)
			.where(eq(systemSettings.id, GLOBAL_SYSTEM_SETTINGS_ID))
			.limit(1)
			.all();
		const row = rows[0];
		if (!row) return null;

		const migrated = parseStoredSettingsRow(row);
		if (migrated.migrated) {
			await persistMigratedSettings(migrated);
		}

		return migrated.settings;
	} catch (error) {
		console.warn("[SystemSettings] Failed to load settings from D1.", error);
		return null;
	}
});

/** Load the stored system settings, applying migrations when needed. */
export async function getSystemSettings(): Promise<SystemSettingsV1 | null> {
	return getCachedSystemSettings();
}

/** Insert or replace the global system settings row. */
export async function upsertSystemSettingsV1(input: SystemSettingsV1, actorUserId?: string) {
	const parsed = SystemSettingsV1Schema.parse(input);
	const now = new Date().toISOString();
	const payload = JSON.stringify(parsed);

	const db = getDb();
	await db
		.insert(systemSettings)
		.values({
			id: GLOBAL_SYSTEM_SETTINGS_ID,
			schemaVersion: CURRENT_SYSTEM_SETTINGS_VERSION,
			payload,
			updatedAt: now,
			updatedBy: actorUserId ?? null,
		})
		.onConflictDoUpdate({
			target: systemSettings.id,
			set: {
				schemaVersion: CURRENT_SYSTEM_SETTINGS_VERSION,
				payload,
				updatedAt: now,
				updatedBy: actorUserId ?? null,
			},
		})
		.run();
}
