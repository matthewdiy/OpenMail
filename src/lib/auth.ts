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
const defaultAuthResendFrom = "OpenMail <onboarding@resend.dev>";

export function isEmailPasswordLoginEnabled() {
	const value = process.env.EMAIL_PASSWORD_LOGIN_ENABLED?.trim().toLowerCase();
	return value === "true" || value === "1" || value === "yes" || value === "on";
}

export function isAuthResendVerificationEnabled() {
	return Boolean(process.env.AUTH_RESEND_API_KEY?.trim());
}

export function getAuthResendFrom() {
	return process.env.AUTH_RESEND_FROM?.trim() || defaultAuthResendFrom;
}

export function isGoogleOAuthEnabled() {
	return Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());
}

export function isGitHubOAuthEnabled() {
	return Boolean(process.env.GITHUB_CLIENT_ID?.trim() && process.env.GITHUB_CLIENT_SECRET?.trim());
}

function getSocialProviders() {
	return {
		...(isGoogleOAuthEnabled()
			? {
				google: {
					clientId: process.env.GOOGLE_CLIENT_ID?.trim() ?? "",
					clientSecret: process.env.GOOGLE_CLIENT_SECRET?.trim() ?? "",
				},
			}
			: {}),
		...(isGitHubOAuthEnabled()
			? {
				github: {
					clientId: process.env.GITHUB_CLIENT_ID?.trim() ?? "",
					clientSecret: process.env.GITHUB_CLIENT_SECRET?.trim() ?? "",
				},
			}
			: {}),
	};
}

function getAuthDb() {
	if (process.env.BETTER_AUTH_CLI) {
		return drizzle({} as D1Database);
	}
	return getDb();
}

async function sendAuthVerificationEmail({
	to,
	url,
}: {
	to: string;
	url: string;
}) {
	const apiKey = process.env.AUTH_RESEND_API_KEY?.trim();
	if (!apiKey) {
		throw new Error("AUTH_RESEND_API_KEY is required to send auth verification emails.");
	}

	const response = await fetch("https://api.resend.com/emails", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			from: getAuthResendFrom(),
			to: [to],
			subject: "Verify your OpenMail email address",
			text: `Verify your OpenMail email address by opening this link: ${url}`,
			html: [
				"<p>Verify your OpenMail email address by opening this link:</p>",
				`<p><a href="${url}">Verify email address</a></p>`,
				`<p>If the button does not work, copy and paste this URL into your browser: ${url}</p>`,
			].join(""),
		}),
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`Resend auth email error: ${response.status} ${errorText}`);
	}
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
	const authResendVerificationEnabled = isAuthResendVerificationEnabled();

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
		socialProviders: getSocialProviders(),
		emailAndPassword: {
			enabled: isEmailPasswordLoginEnabled(),
			requireEmailVerification: authResendVerificationEnabled,
		},
		emailVerification: authResendVerificationEnabled
			? {
				sendOnSignUp: true,
				sendOnSignIn: true,
				sendVerificationEmail: async ({ user, url }) => {
					await sendAuthVerificationEmail({
						to: user.email,
						url,
					});
				},
			}
			: undefined,
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
