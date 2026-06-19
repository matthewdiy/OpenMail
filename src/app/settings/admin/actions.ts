"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getAuth } from "@/lib/auth";
import { user } from "@/lib/auth-schema";
import { getDb } from "@/lib/db";
import { DEFAULT_EMAIL_ACCOUNT_QUOTA } from "@/lib/user-access";
import {
	DEFAULT_SYSTEM_SETTINGS_V1,
	getSystemSettings,
	parseEmailDomainsFormData,
	parseSystemSettingsV1FormData,
	upsertSystemSettingsV1,
} from "@/lib/system-settings";

async function requireAdminUserId() {
	const reqHeaders = await headers();
	const session = await getAuth().api.getSession({ headers: reqHeaders });
	if (!session) throw new Error("Unauthorized");
	if (session.user.role !== "admin") {
		throw new Error("Forbidden");
	}
	return session.user.id;
}

export async function updateUserEmailQuotaAction(formData: FormData) {
	await requireAdminUserId();

	const targetUserId = (formData.get("userId") as string | null)?.trim();
	const rawQuota = Number(formData.get("quota"));
	if (!targetUserId) throw new Error("Missing userId");
	if (!Number.isInteger(rawQuota) || rawQuota < DEFAULT_EMAIL_ACCOUNT_QUOTA) {
		throw new Error(`Quota must be an integer >= ${DEFAULT_EMAIL_ACCOUNT_QUOTA}.`);
	}

	const db = getDb();
	await db
		.update(user)
		.set({ email_quotas: rawQuota, updatedAt: new Date() })
		.where(eq(user.id, targetUserId))
		.run();

	revalidatePath("/settings/admin");
	revalidatePath("/settings/accounts");
}

export async function updateMailSystemSettingsAction(formData: FormData) {
	const userId = await requireAdminUserId();

	const currentSettings = (await getSystemSettings()) ?? DEFAULT_SYSTEM_SETTINGS_V1;
	const settings = parseSystemSettingsV1FormData(formData);
	await upsertSystemSettingsV1(
		{
			...settings,
			mail: {
				...settings.mail,
				emailDomains: currentSettings.mail.emailDomains,
			},
		},
		userId
	);

	revalidatePath("/settings/admin");
}

export async function updateEmailDomainSettingsAction(formData: FormData) {
	const userId = await requireAdminUserId();
	const currentSettings = (await getSystemSettings()) ?? DEFAULT_SYSTEM_SETTINGS_V1;
	const emailDomains = parseEmailDomainsFormData(formData);

	await upsertSystemSettingsV1(
		{
			...currentSettings,
			mail: {
				...currentSettings.mail,
				emailDomains,
			},
		},
		userId
	);

	revalidatePath("/settings");
	revalidatePath("/settings/admin");
}
