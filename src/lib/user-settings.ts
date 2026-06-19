import { eq } from "drizzle-orm";
import { cache } from "react";
import { z } from "zod";
import { getDb } from "./db";
import { DEFAULT_USER_SETTINGS, DEFAULT_USER_SETTINGS_JSON } from "./user-settings-defaults";
import { user } from "./auth-schema";

export const CURRENT_USER_SETTINGS_VERSION = 1;

const userSettingsV1Schema = z.object({
	schemaVersion: z.literal(1),
	mail: z.object({
		trashExpireDays: z.number().int().min(1).max(365),
		categories: z.array(z.string().trim().min(1)).min(1),
	}),
});

const userSettingsUpdateSchema = z.object({
	mail: z
		.object({
			trashExpireDays: z.number().int().min(1).max(365).optional(),
			categories: z.array(z.string().trim().min(1)).min(1).optional(),
		})
		.optional(),
});

export type UserSettingsV1 = z.infer<typeof userSettingsV1Schema>;
export type UserSettingsUpdate = z.infer<typeof userSettingsUpdateSchema>;

/** Parse stored user settings and fall back to defaults when data is missing or stale. */
export function parseUserSettings(rawSettings: string | null | undefined): UserSettingsV1 {
	if (!rawSettings) {
		return DEFAULT_USER_SETTINGS;
	}

	try {
		const parsedJson = JSON.parse(rawSettings);
		const parsedSettings = userSettingsV1Schema.safeParse(parsedJson);
		return parsedSettings.success ? parsedSettings.data : DEFAULT_USER_SETTINGS;
	} catch {
		return DEFAULT_USER_SETTINGS;
	}
}

/** Validate and serialize settings before persisting them to the user row. */
export function serializeUserSettings(settings: UserSettingsV1): string {
	return JSON.stringify(userSettingsV1Schema.parse(settings));
}

/** Trim, de-duplicate, and preserve category order for user-defined mail buckets. */
export function normalizeUserCategories(categories: string[]) {
	const seen = new Set<string>();
	const normalized: string[] = [];

	for (const category of categories) {
		const trimmed = category.trim();
		if (!trimmed) continue;
		const key = trimmed.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		normalized.push(trimmed);
	}

	return normalized.length > 0 ? normalized : [...DEFAULT_USER_SETTINGS.mail.categories];
}

/** Format categories for prompts and compact display surfaces. */
export function formatUserCategories(categories: string[]) {
	return normalizeUserCategories(categories).join(", ");
}

/** Read a user's settings from D1, returning defaults for older or incomplete users. */
async function loadUserSettings(
	userId: string,
	env?: CloudflareEnv
): Promise<UserSettingsV1> {
	const db = getDb(env);
	const rows = await db
		.select({ settings: user.settings })
		.from(user)
		.where(eq(user.id, userId))
		.limit(1)
		.all();

	return parseUserSettings(rows[0]?.settings);
}

/** Load a user's settings once per server request/render pass. */
const getCachedUserSettings = cache(async (userId: string): Promise<UserSettingsV1> => {
	return loadUserSettings(userId);
});

/** Load a user's settings from D1, returning defaults for older or incomplete users. */
export async function getUserSettings(
	userId: string,
	env?: CloudflareEnv
): Promise<UserSettingsV1> {
	if (env) {
		return loadUserSettings(userId, env);
	}

	return getCachedUserSettings(userId);
}

/** Merge a partial settings update with the current stored settings. */
export async function updateUserSettings(
	userId: string,
	input: UserSettingsUpdate
): Promise<UserSettingsV1> {
	const parsedInput = userSettingsUpdateSchema.parse(input);
	const currentSettings = await loadUserSettings(userId);
	const nextSettings: UserSettingsV1 = {
		schemaVersion: CURRENT_USER_SETTINGS_VERSION,
		mail: {
			trashExpireDays:
				parsedInput.mail?.trashExpireDays ?? currentSettings.mail.trashExpireDays,
			categories: parsedInput.mail?.categories
				? normalizeUserCategories(parsedInput.mail.categories)
				: currentSettings.mail.categories,
		},
	};

	const serializedSettings = serializeUserSettings(nextSettings);
	const db = getDb();
	await db
		.update(user)
		.set({
			settings: serializedSettings,
			updatedAt: new Date(),
		})
		.where(eq(user.id, userId))
		.run();

	return nextSettings;
}

export { DEFAULT_USER_SETTINGS, DEFAULT_USER_SETTINGS_JSON };
