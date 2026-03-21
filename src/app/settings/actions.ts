"use server";
import { getDb } from "@/lib/db";
import { settings } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function updateExpireSettingsAction(days: number) {
	const db = getDb();
	await db.insert(settings)
		.values({ key: "trash_expire_days", value: days.toString() })
		.onConflictDoUpdate({
			target: settings.key,
			set: { value: days.toString() }
		})
		.run();
	revalidatePath("/settings");
}
export async function updateCategoriesAction(categories: string) {
	const db = getDb();
	await db.insert(settings)
		.values({ key: "email_categories", value: categories })
		.onConflictDoUpdate({
			target: settings.key,
			set: { value: categories }
		})
		.run();
	revalidatePath("/settings");
}
