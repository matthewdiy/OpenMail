import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { userEmailQuotas } from "@/lib/schema";

export const DEFAULT_EMAIL_ACCOUNT_QUOTA = 1;

export async function getEmailAccountQuotaByUserId(userId: string) {
	const db = getDb();
	const rows = await db
		.select({ quota: userEmailQuotas.quota })
		.from(userEmailQuotas)
		.where(eq(userEmailQuotas.userId, userId))
		.limit(1)
		.all();
	const value = rows[0]?.quota ?? DEFAULT_EMAIL_ACCOUNT_QUOTA;
	return Math.max(value, DEFAULT_EMAIL_ACCOUNT_QUOTA);
}
