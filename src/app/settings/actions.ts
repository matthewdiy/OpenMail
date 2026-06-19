"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { linkEmailAddressForUser } from "@/lib/email-address-access";
import { getSystemSettings } from "@/lib/system-settings";
import { normalizeUserCategories, updateUserSettings } from "@/lib/user-settings";

async function requireSession() {
	const reqHeaders = await headers();
	const session = await getAuth().api.getSession({ headers: reqHeaders });
	if (!session) throw new Error("Unauthorized");
	return session;
}

async function requireUserId() {
	const session = await requireSession();
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

/** Create a temporary address only for domains configured by an admin. */
export async function createTemporaryEmailAddressAction(formData: FormData) {
	const session = await requireSession();
	const localPart = String(formData.get("email_name") ?? "")
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9._+-]/g, "");
	const domain = String(formData.get("email_domain") ?? "")
		.trim()
		.toLowerCase()
		.replace(/^@+/, "");
	const rawExpireDay = Number(formData.get("expire_day") ?? 1);

	if (!localPart) {
		throw new Error("Email name is required.");
	}
	if (!Number.isInteger(rawExpireDay) || rawExpireDay <= 0) {
		throw new Error("Expire day must be a positive integer.");
	}

	const systemSettings = await getSystemSettings();
	const allowedDomains = systemSettings?.mail.emailDomains ?? [];
	if (!allowedDomains.includes(domain)) {
		throw new Error("Selected email domain is not available.");
	}

	const emailAddress = `${localPart}@${domain}`;
	const linkedEmailAddress = await linkEmailAddressForUser({
		userId: session.user.id,
		emailAddress,
		isAdmin: session.user.role === "admin",
		temporary: true,
		expireDay: rawExpireDay,
	});

	revalidatePath("/settings");
	revalidatePath("/settings/accounts");
	revalidatePath("/mail");
	redirect(`/mail?email=${encodeURIComponent(linkedEmailAddress.emailAddress)}`);
}
