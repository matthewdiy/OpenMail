import { getAuth } from "@/lib/auth";
import { userOwnsEmailAddress } from "@/lib/email-address-access";
import {
	countInboxEmailsByAddress,
	listInboxEmailsByAddress,
} from "@/lib/mail-store";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

function parsePositiveInteger(value: string | null, fallback: number) {
	const parsed = Number.parseInt(value ?? "", 10);
	if (!Number.isFinite(parsed) || parsed < 1) return fallback;
	return parsed;
}

function serializeEmailMetadata(email: Awaited<ReturnType<typeof listInboxEmailsByAddress>>[number]) {
	return {
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
	};
}

export async function GET(request: Request) {
	const session = await getAuth().api.getSession({ headers: request.headers });
	if (!session) {
		return Response.json({ error: "Missing or invalid API key." }, { status: 401 });
	}

	const url = new URL(request.url);
	const email = url.searchParams.get("email")?.trim().toLowerCase();
	if (!email) {
		return Response.json({ error: "Email address is required." }, { status: 400 });
	}
	if (!(await userOwnsEmailAddress(session.user.id, email))) {
		return Response.json({ error: "Email address not found." }, { status: 404 });
	}

	const page = parsePositiveInteger(url.searchParams.get("page"), DEFAULT_PAGE);
	const rawPageSize = parsePositiveInteger(url.searchParams.get("pageSize"), DEFAULT_PAGE_SIZE);
	const pageSize = Math.min(rawPageSize, MAX_PAGE_SIZE);
	const offset = (page - 1) * pageSize;

	const [total, rows] = await Promise.all([
		countInboxEmailsByAddress(email, { mailbox: "inbox" }),
		listInboxEmailsByAddress(email, {
			mailbox: "inbox",
			limit: pageSize,
			offset,
		}),
	]);

	return Response.json({
		data: rows.map(serializeEmailMetadata),
		pagination: {
			page,
			pageSize,
			total,
			totalPages: Math.max(1, Math.ceil(total / pageSize)),
		},
	});
}
