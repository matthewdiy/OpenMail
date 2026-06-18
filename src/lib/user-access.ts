import { eq } from "drizzle-orm";
import { user } from "@/lib/auth-schema";
import { getDb } from "@/lib/db";

export const DEFAULT_EMAIL_ACCOUNT_QUOTA = 1; // TODO: default email quota should be set by admin in the system settings

export async function getEmailAccountQuotaByUserId(userId: string) {
	const db = getDb();
	const rows = await db
		.select({ quota: user.email_quotas })
		.from(user)
		.where(eq(user.id, userId))
		.limit(1)
		.all();
	const value = rows[0]?.quota ?? DEFAULT_EMAIL_ACCOUNT_QUOTA;
	return Math.max(value, DEFAULT_EMAIL_ACCOUNT_QUOTA);
}
