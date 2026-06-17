"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getAuth } from "@/lib/auth";
import { normalizeUserCategories, updateUserSettings } from "@/lib/user-settings";

async function requireUserId() {
	const reqHeaders = await headers();
	const session = await getAuth().api.getSession({ headers: reqHeaders });
	if (!session) throw new Error("Unauthorized");
	return session.user.id;
}

export async function updateExpireSettingsAction(days: number) {
	const userId = await requireUserId();
	await updateUserSettings(userId, {
		mail: {
			trashExpireDays: days,
		},
	});
	revalidatePath("/settings");
}

export async function updateCategoriesAction(categories: string) {
	const userId = await requireUserId();
	await updateUserSettings(userId, {
		mail: {
			categories: normalizeUserCategories(categories.split(",")),
		},
	});
	revalidatePath("/settings");
	revalidatePath("/mail");
}
