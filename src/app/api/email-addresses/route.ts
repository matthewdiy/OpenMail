import { getAuth } from "@/lib/auth";
import {
	linkEmailAddressForUser,
	unlinkEmailAddressForUser,
} from "@/lib/email-address-access";

async function getApiSession(request: Request) {
	const session = await getAuth().api.getSession({ headers: request.headers });
	if (!session) {
		return {
			ok: false as const,
			response: Response.json({ error: "Missing or invalid API key." }, { status: 401 }),
		};
	}
	return { ok: true as const, session };
}

type EmailAddressBody = {
	emailAddress?: unknown;
	temporary?: unknown;
	expireDay?: unknown;
};

function readTemporaryFlag(body: EmailAddressBody | null) {
	return body?.temporary === true;
}

function readExpireDay(body: EmailAddressBody | null, temporary: boolean) {
	const rawExpireDay = body?.expireDay;
	if (rawExpireDay === undefined || rawExpireDay === null || rawExpireDay === "") {
		return temporary ? 1 : undefined;
	}

	const expireDay = typeof rawExpireDay === "number" ? rawExpireDay : Number(rawExpireDay);
	if (!Number.isFinite(expireDay) || !Number.isInteger(expireDay) || expireDay <= 0) {
		throw new Error("Expire day must be a positive integer.");
	}
	return expireDay;
}

async function readEmailAddressBody(request: Request) {
	const body = (await request.json().catch(() => null)) as EmailAddressBody | null;
	const emailAddress = typeof body?.emailAddress === "string" ? body.emailAddress : "";
	if (!emailAddress.trim()) {
		throw new Error("Email address is required.");
	}
	const temporary = readTemporaryFlag(body);
	return {
		emailAddress,
		temporary,
		expireDay: readExpireDay(body, temporary),
	};
}

async function readEmailAddress(request: Request) {
	const body = (await request.json().catch(() => null)) as EmailAddressBody | null;
	const emailAddress = typeof body?.emailAddress === "string" ? body.emailAddress : "";
	if (!emailAddress.trim()) {
		throw new Error("Email address is required.");
	}
	return emailAddress;
}

export async function POST(request: Request) {
	const auth = await getApiSession(request);
	if (!auth.ok) return auth.response;

	try {
		const emailAddressBody = await readEmailAddressBody(request);
		const linkedEmailAddress = await linkEmailAddressForUser({
			userId: auth.session.user.id,
			emailAddress: emailAddressBody.emailAddress,
			isAdmin: auth.session.user.role === "admin",
			temporary: emailAddressBody.temporary,
			expireDay: emailAddressBody.expireDay,
		});
		return Response.json(linkedEmailAddress, { status: 201 });
	} catch (error) {
		return Response.json(
			{ error: error instanceof Error ? error.message : "Unable to link email address." },
			{ status: 400 }
		);
	}
}

export async function DELETE(request: Request) {
	const auth = await getApiSession(request);
	if (!auth.ok) return auth.response;

	try {
		const emailAddress = await readEmailAddress(request);
		const unlinkedEmailAddress = await unlinkEmailAddressForUser(auth.session.user.id, emailAddress);
		return Response.json({ emailAddress: unlinkedEmailAddress });
	} catch (error) {
		return Response.json(
			{ error: error instanceof Error ? error.message : "Unable to unlink email address." },
			{ status: 400 }
		);
	}
}
