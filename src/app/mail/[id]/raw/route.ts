import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getEmailByIdForAddress, resolveActiveEmailAddress } from "@/lib/mail-store";
import { getAuth } from "@/lib/auth";
import { headers } from "next/headers";


export async function GET(
	req: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const reqHeaders = await headers();
	const session = await getAuth().api.getSession({ headers: reqHeaders });
	if (!session) {
		return new Response("Unauthorized", { status: 401 });
	}

	const url = new URL(req.url);
	const requestedEmail = url.searchParams.get("email");
	const { activeEmail, needsRedirect } = await resolveActiveEmailAddress(session.user.id, requestedEmail);
	if (!activeEmail) {
		return new Response("Unauthorized", { status: 401 });
	}

	const { id } = await params;
	if (needsRedirect) {
		return Response.redirect(new URL(`/mail/${id}/raw?email=${encodeURIComponent(activeEmail)}`, req.url), 302);
	}

	const email = await getEmailByIdForAddress(id, activeEmail);

	if (!email) {
		return new Response("Not found", { status: 404 });
	}

	const { env } = getCloudflareContext();
	const object = await env.MAIL_R2.get(email.r2_key);
	if (!object) {
		return new Response("Not found", { status: 404 });
	}

	const filename = `${email.id}.eml`;
	return new Response(object.body, {
		headers: {
			"content-type": object.httpMetadata?.contentType ?? "message/rfc822",
			"content-disposition": `inline; filename="${filename}"`,
		},
	});
}
