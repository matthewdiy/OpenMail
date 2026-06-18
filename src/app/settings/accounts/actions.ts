"use server";
import { revalidatePath } from "next/cache";
import { getAuth } from "@/lib/auth";
import { headers } from "next/headers";
import {
	linkEmailAddressForUser,
	unlinkEmailAddressForUser,
} from "@/lib/email-address-access";

export async function addEmailAccountAction(emailAddress: string) {
	const reqHeaders = await headers();
	const session = await getAuth().api.getSession({ headers: reqHeaders });
	if (!session) throw new Error("Unauthorized");

	await linkEmailAddressForUser({
		userId: session.user.id,
		emailAddress,
		isAdmin: session.user.role === "admin",
	});

	revalidatePath("/settings/accounts");
	revalidatePath("/onboard");
	revalidatePath("/mail");
}

export async function deleteEmailAccountAction(emailAddress: string) {
	const reqHeaders = await headers();
	const session = await getAuth().api.getSession({ headers: reqHeaders });
	if (!session) throw new Error("Unauthorized");
	await unlinkEmailAddressForUser(session.user.id, emailAddress);

	revalidatePath("/settings/accounts");
	revalidatePath("/settings/admin");
}
