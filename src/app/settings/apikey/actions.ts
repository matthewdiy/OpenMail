"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getAuth } from "@/lib/auth";

async function requireSessionHeaders() {
	const reqHeaders = await headers();
	const session = await getAuth().api.getSession({ headers: reqHeaders });
	if (!session) {
		throw new Error("Unauthorized");
	}
	return reqHeaders;
}

export async function createApiKeyAction(formData: FormData) {
	const reqHeaders = await requireSessionHeaders();
	const name = String(formData.get("name") ?? "").trim() || "OpenMail API key";
	const apiKey = await getAuth().api.createApiKey({
		headers: reqHeaders,
		body: {
			name,
			prefix: "om",
		},
	});

	revalidatePath("/settings/apikey");
	redirect(`/settings/apikey?created=${encodeURIComponent(apiKey.key)}`);
}

export async function deleteApiKeyAction(formData: FormData) {
	const reqHeaders = await requireSessionHeaders();
	const keyId = String(formData.get("keyId") ?? "").trim();
	if (!keyId) {
		throw new Error("API key id is required.");
	}

	await getAuth().api.deleteApiKey({
		headers: reqHeaders,
		body: { keyId },
	});

	revalidatePath("/settings/apikey");
}
