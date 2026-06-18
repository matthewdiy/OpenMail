import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins/admin";
import { apiKey } from "@better-auth/api-key";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { getDb } from "@/lib/db";
import * as schema from "@/lib/auth-schema";
import { DEFAULT_USER_SETTINGS_JSON } from "@/lib/user-settings-defaults";

const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();

function getAuthDb() {
	if (process.env.BETTER_AUTH_CLI) {
		return drizzle({} as D1Database);
	}
	return getDb();
}

async function ensureAdminRoleForUserId(userId: string) {
	if (!adminEmail) return;
	const db = getDb();
	const rows = await db
		.select({ email: schema.user.email, role: schema.user.role })
		.from(schema.user)
		.where(eq(schema.user.id, userId))
		.limit(1)
		.all();
	const currentUser = rows[0];
	if (!currentUser) return;
	if (currentUser.email?.toLowerCase() === adminEmail && currentUser.role !== "admin") {
		await db
			.update(schema.user)
			.set({ role: "admin" })
			.where(eq(schema.user.id, userId))
			.run();
	}
}

export function createAuth() {
	return betterAuth({
		appName: "OpenMail",
		baseURL: process.env.BETTER_AUTH_URL,
		secret: process.env.BETTER_AUTH_SECRET,
		database: drizzleAdapter(getAuthDb(), {
			provider: "sqlite",
			schema: schema,
		}),
		user: {
			additionalFields: {
				settings: {
					type: "string",
					required: false,
				},
				emailQuotas: {
					type: "number",
					required: false,
					fieldName: "email_quotas",
					input: false,
				},
			},
		},
		socialProviders: {
			google: {
				clientId: process.env.GOOGLE_CLIENT_ID ?? "",
				clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
			},
		},
		plugins: [
			admin({
				defaultRole: "user",
				adminRoles: ["admin"],
			}),
			apiKey({
				enableSessionForAPIKeys: true,
				customAPIKeyGetter: (ctx) => {
					const explicitKey = ctx.headers?.get("x-api-key")?.trim();
					if (explicitKey) return explicitKey;

					const authorization = ctx.headers?.get("authorization")?.trim();
					const match = authorization?.match(/^Bearer\s+(.+)$/i);
					return match?.[1]?.trim() ?? null;
				},
				rateLimit: {
					enabled: true,
					timeWindow: 60 * 1000,
					maxRequests: 120,
				},
			}),
			nextCookies(),
		],
		databaseHooks: {
			user: {
				create: {
					before: async (user) => ({
						data: {
							...user,
							settings:
								typeof user.settings === "string"
									? user.settings
									: DEFAULT_USER_SETTINGS_JSON,
						},
					}),
				},
			},
			session: {
				create: {
					before: async (session) => {
						await ensureAdminRoleForUserId(session.userId);
						return { data: session };
					},
				},
			},
		},
	});
}

let authInstance: ReturnType<typeof createAuth> | null = null;

export function getAuth() {
	if (!authInstance) {
		authInstance = createAuth();
	}
	return authInstance; // Cast as any or ReturnType<typeof createAuth> to handle generic resolution if needed
}

export const auth: ReturnType<typeof createAuth> = new Proxy(
	{} as ReturnType<typeof createAuth>,
	{
		get(_target, prop) {
			return getAuth()[prop as keyof ReturnType<typeof createAuth>];
		},
	}
);

export type Session = ReturnType<typeof getAuth>["$Infer"]["Session"];
