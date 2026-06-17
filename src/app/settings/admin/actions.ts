"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { userEmailQuotas } from "@/lib/schema";
import { DEFAULT_EMAIL_ACCOUNT_QUOTA } from "@/lib/user-access";
import { parseSystemSettingsV1FormData, upsertSystemSettingsV1 } from "@/lib/system-settings";

export async function updateUserEmailQuotaAction(formData: FormData) {
	const reqHeaders = await headers();
	const session = await getAuth().api.getSession({ headers: reqHeaders });
	if (!session) throw new Error("Unauthorized");
	if (session.user.role !== "admin") {
		throw new Error("Forbidden");
	}

	const targetUserId = (formData.get("userId") as string | null)?.trim();
	const rawQuota = Number(formData.get("quota"));
	if (!targetUserId) throw new Error("Missing userId");
	if (!Number.isInteger(rawQuota) || rawQuota < DEFAULT_EMAIL_ACCOUNT_QUOTA) {
		throw new Error(`Quota must be an integer >= ${DEFAULT_EMAIL_ACCOUNT_QUOTA}.`);
	}

	const db = getDb();
	await db
		.insert(userEmailQuotas)
		.values({
			userId: targetUserId,
			quota: rawQuota,
			updatedAt: new Date().toISOString(),
		})
		.onConflictDoUpdate({
			target: userEmailQuotas.userId,
			set: {
				quota: rawQuota,
				updatedAt: new Date().toISOString(),
			},
		})
		.run();

	revalidatePath("/settings/admin");
	revalidatePath("/settings/accounts");
}

export async function updateMailSystemSettingsAction(formData: FormData) {
	const reqHeaders = await headers();
	const session = await getAuth().api.getSession({ headers: reqHeaders });
	if (!session) throw new Error("Unauthorized");
	if (session.user.role !== "admin") {
		throw new Error("Forbidden");
	}

	const settings = parseSystemSettingsV1FormData(formData);
	await upsertSystemSettingsV1(settings, session.user.id);

	revalidatePath("/settings/admin");
}
