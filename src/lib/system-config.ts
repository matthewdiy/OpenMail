import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { systemConfig } from "@/lib/schema";

export const GLOBAL_SYSTEM_CONFIG_ID = "global";
export const CURRENT_SYSTEM_CONFIG_VERSION = 1;

export const MailProviderSchema = z.enum(["smtp", "resend", "local"]);
export type MailProvider = z.infer<typeof MailProviderSchema>;

const trimToUndefined = (value: string | undefined) => {
	if (value === undefined) return undefined;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
};

const optionalTextSchema = z.preprocess(
	(value) => (typeof value === "string" ? value : undefined),
	z.string().optional()
).transform(trimToUndefined);

const textSchema = z.preprocess(
	(value) => (typeof value === "string" ? value : ""),
	z.string()
);

const smtpPortSchema = z.preprocess(
	(value) => (value === undefined || value === null || value === "" ? "587" : value),
	z.coerce.number().int().min(1).max(65535)
).catch(587);

const booleanLikeSchema = z.preprocess(
	(value) => (value === undefined || value === null || value === "" ? "false" : value),
	z.union([z.string(), z.boolean()])
).transform((value) => value === true || value === "true").catch(false);

const smtpConfigSchema = z.object({
	host: z.string(),
	port: z.number().int().min(1).max(65535),
	secure: z.boolean(),
	user: z.string(),
	pass: z.string(),
});

const resendConfigSchema = z.object({
	apiKey: z.string(),
});

const localConfigSchema = z.object({
	baseUrl: z.string().optional(),
});

export const SystemConfigV1Schema = z.object({
	mail: z.object({
		provider: MailProviderSchema,
		smtp: smtpConfigSchema,
		resend: resendConfigSchema,
		local: localConfigSchema,
	}),
});

export type SystemConfigV1 = z.infer<typeof SystemConfigV1Schema>;

type SystemConfigMigrator = (payload: unknown) => unknown;

const SYSTEM_CONFIG_MIGRATORS: Partial<Record<number, SystemConfigMigrator>> = {};

const migrationSchema = z
	.object({
		schemaVersion: z.number().int().min(1),
		payload: z.unknown(),
	})
	.transform((value, ctx) => {
		if (value.schemaVersion > CURRENT_SYSTEM_CONFIG_VERSION) {
			ctx.addIssue({
				code: "custom",
				message: `Unsupported system config version ${value.schemaVersion}`,
			});
			return z.NEVER;
		}

		let nextPayload = value.payload;
		let version = value.schemaVersion;

		while (version < CURRENT_SYSTEM_CONFIG_VERSION) {
			const migrator = SYSTEM_CONFIG_MIGRATORS[version];
			if (!migrator) {
				ctx.addIssue({
					code: "custom",
					message: `Missing system config migrator for version ${version}`,
				});
				return z.NEVER;
			}

			try {
				nextPayload = migrator(nextPayload);
			} catch (error) {
				ctx.addIssue({
					code: "custom",
					message: `System config migrator ${version} failed: ${error instanceof Error ? error.message : "unknown error"}`,
				});
				return z.NEVER;
			}

			version += 1;
		}

		const parsedConfig = SystemConfigV1Schema.safeParse(nextPayload);
		if (!parsedConfig.success) {
			for (const issue of parsedConfig.error.issues) {
				ctx.addIssue({ ...issue, path: ["payload", ...issue.path] });
			}
			return z.NEVER;
		}

		return {
			config: parsedConfig.data,
			schemaVersion: version,
			migrated: version !== value.schemaVersion,
		};
	});

const storedConfigSchema = z
	.object({
		schemaVersion: z.number().int().min(1),
		payload: z.string(),
	})
	.transform((row, ctx) => {
		let parsedPayload: unknown;
		try {
			parsedPayload = JSON.parse(row.payload);
		} catch {
			ctx.addIssue({
				code: "custom",
				message: "system_config payload must be valid JSON",
			});
			return z.NEVER;
		}

		const migrated = migrationSchema.safeParse({
			schemaVersion: row.schemaVersion,
			payload: parsedPayload,
		});
		if (!migrated.success) {
			for (const issue of migrated.error.issues) {
				ctx.addIssue({
					code: "custom",
					message: issue.message,
					path: issue.path,
				});
			}
			return z.NEVER;
		}

		return migrated.data;
	});

const envConfigSchema = z
	.object({
		MAIL_PROVIDER: z.string().optional(),
		SMTP_HOST: z.string().optional(),
		SMTP_PORT: z.string().optional(),
		SMTP_SECURE: z.string().optional(),
		SMTP_USER: z.string().optional(),
		SMTP_PASS: z.string().optional(),
		RESEND_API_KEY: z.string().optional(),
		LOCAL_WORKER_URL: z.string().optional(),
	})
	.transform((env): SystemConfigV1 => {
		const provider = MailProviderSchema.catch("smtp").parse(env.MAIL_PROVIDER);
		const effectiveProvider =
			process.env.NODE_ENV === "development" || provider !== "local"
				? provider
				: "smtp";

		return {
			mail: {
				provider: effectiveProvider,
				smtp: {
					host: env.SMTP_HOST ?? "",
					port: smtpPortSchema.parse(env.SMTP_PORT),
					secure: booleanLikeSchema.parse(env.SMTP_SECURE),
					user: env.SMTP_USER ?? "",
					pass: env.SMTP_PASS ?? "",
				},
				resend: {
					apiKey: env.RESEND_API_KEY ?? "",
				},
				local: {
					baseUrl: trimToUndefined(env.LOCAL_WORKER_URL) ?? "http://127.0.0.1:8787",
				},
			},
		};
	});

const systemConfigFormSchema = z
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
	.transform((form): SystemConfigV1 => ({
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
		},
	}))
	.superRefine((config, ctx) => {
		if (process.env.NODE_ENV !== "development" && config.mail.provider === "local") {
			ctx.addIssue({
				code: "custom",
				path: ["mail", "provider"],
				message: "Local provider is only available in development mode.",
			});
		}
	});

export function parseSystemConfigV1(payload: unknown): SystemConfigV1 | null {
	const parsed = SystemConfigV1Schema.safeParse(payload);
	return parsed.success ? parsed.data : null;
}

export function parseSystemConfigV1FormData(formData: FormData): SystemConfigV1 {
	const rawValues = Object.fromEntries(formData.entries());
	return systemConfigFormSchema.parse(rawValues);
}

export function migrateSystemConfigToLatest(payload: unknown, fromVersion: number): {
	payload: SystemConfigV1;
	version: number;
} {
	const migrated = migrationSchema.parse({ schemaVersion: fromVersion, payload });
	return {
		payload: migrated.config,
		version: migrated.schemaVersion,
	};
}

export function buildSystemConfigV1FromEnv(): SystemConfigV1 {
	return envConfigSchema.parse({
		MAIL_PROVIDER: process.env.MAIL_PROVIDER,
		SMTP_HOST: process.env.SMTP_HOST,
		SMTP_PORT: process.env.SMTP_PORT,
		SMTP_SECURE: process.env.SMTP_SECURE,
		SMTP_USER: process.env.SMTP_USER,
		SMTP_PASS: process.env.SMTP_PASS,
		RESEND_API_KEY: process.env.RESEND_API_KEY,
		LOCAL_WORKER_URL: process.env.LOCAL_WORKER_URL,
	});
}

export async function getSystemConfig(): Promise<SystemConfigV1 | null> {
	try {
		const db = getDb();
		const rows = await db
			.select()
			.from(systemConfig)
			.where(eq(systemConfig.id, GLOBAL_SYSTEM_CONFIG_ID))
			.limit(1)
			.all();
		const row = rows[0];
		if (!row) return null;

		const parsed = storedConfigSchema.safeParse({
			schemaVersion: row.schemaVersion,
			payload: row.payload,
		});
		if (!parsed.success) {
			console.warn("[SystemConfig] Invalid stored config, fallback to env.", parsed.error.flatten());
			return null;
		}

		if (parsed.data.migrated) {
			await db
				.update(systemConfig)
				.set({
					schemaVersion: parsed.data.schemaVersion,
					payload: JSON.stringify(parsed.data.config),
					updatedAt: new Date().toISOString(),
				})
				.where(eq(systemConfig.id, GLOBAL_SYSTEM_CONFIG_ID))
				.run();
		}

		return parsed.data.config;
	} catch (error) {
		console.warn("[SystemConfig] Failed to load config from D1, fallback to env.", error);
		return null;
	}
}

export async function upsertSystemConfigV1(input: SystemConfigV1, actorUserId?: string) {
	const parsed = SystemConfigV1Schema.parse(input);

	const db = getDb();
	await db
		.insert(systemConfig)
		.values({
			id: GLOBAL_SYSTEM_CONFIG_ID,
			schemaVersion: CURRENT_SYSTEM_CONFIG_VERSION,
			payload: JSON.stringify(parsed),
			updatedAt: new Date().toISOString(),
			updatedBy: actorUserId ?? null,
		})
		.onConflictDoUpdate({
			target: systemConfig.id,
			set: {
				schemaVersion: CURRENT_SYSTEM_CONFIG_VERSION,
				payload: JSON.stringify(parsed),
				updatedAt: new Date().toISOString(),
				updatedBy: actorUserId ?? null,
			},
		})
		.run();
}

export async function bootstrapSystemConfigFromEnvIfMissing(): Promise<SystemConfigV1 | null> {
	try {
		const db = getDb();
		const existing = await db
			.select({ id: systemConfig.id })
			.from(systemConfig)
			.where(eq(systemConfig.id, GLOBAL_SYSTEM_CONFIG_ID))
			.limit(1)
			.all();
		if (existing[0]) {
			return await getSystemConfig();
		}

		const payload = buildSystemConfigV1FromEnv();
		await db
			.insert(systemConfig)
			.values({
				id: GLOBAL_SYSTEM_CONFIG_ID,
				schemaVersion: CURRENT_SYSTEM_CONFIG_VERSION,
				payload: JSON.stringify(payload),
				updatedAt: new Date().toISOString(),
				updatedBy: null,
			})
			.onConflictDoNothing({ target: systemConfig.id })
			.run();

		return await getSystemConfig();
	} catch (error) {
		console.warn("[SystemConfig] Failed to bootstrap config from env.", error);
		return null;
	}
}
