import { getAuth } from "@/lib/auth";
import { parseRawEmailBuffer, stripHtml } from "@/lib/email-parser";
import { getEmailById, getEmailObject } from "@/lib/mail-store";

function extractBody(rawText: string) {
	const parts = rawText.split(/\r?\n\r?\n/);
	if (parts.length <= 1) return rawText;
	return parts.slice(1).join("\n\n").trim();
}

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const session = await getAuth().api.getSession({ headers: request.headers });
	if (!session) {
		return Response.json({ error: "Missing or invalid API key." }, { status: 401 });
	}

	const { id } = await params;
	const email = await getEmailById(id, session.user.id);
	if (!email) {
		return Response.json({ error: "Email not found." }, { status: 404 });
	}

	const r2Object = await getEmailObject(email.r2_key);
	if (!r2Object) {
		return Response.json({ error: "Email content not found." }, { status: 404 });
	}

	const rawBuffer = await r2Object.arrayBuffer();
	const rawPreview = new TextDecoder().decode(rawBuffer.slice(0, 50_000));
	let html: string | null = null;
	let text = extractBody(rawPreview).slice(0, 10_000);
	try {
		const parsed = await parseRawEmailBuffer(rawBuffer);
		html = parsed.html?.trim() || null;
		const parsedText = parsed.text?.trim() || (parsed.html ? stripHtml(parsed.html) : "").trim();
		if (parsedText) {
			text = parsedText;
		}
	} catch (error) {
		console.error("Failed to parse raw email for API response:", error);
	}

	return Response.json({
		id: email.id,
		messageId: email.message_id,
		from: email.from_addr,
		to: email.to_addr,
		subject: email.subject,
		receivedAt: email.received_at,
		sizeBytes: email.size_bytes,
		snippet: email.snippet,
		starred: email.starred,
		deleted: email.deleted,
		read: email.read,
		verificationCode: email.verification_code,
		summary: email.summary,
		category: email.category,
		content: {
			text,
			html,
		},
	});
}
