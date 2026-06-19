import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { getAuth } from "@/lib/auth";
import { getEmailByIdForAddress, getEmailObject, resolveActiveEmailAddress } from "@/lib/mail-store";
import { ArrowLeft, Archive, MoreVertical, Reply, Forward } from "lucide-react";
import { StarButton, DeleteDetailButton } from "@/components/mail/action-buttons";
import { SanitizedEmailContent } from "@/components/mail/sanitized-email-content";
import { getDb } from "@/lib/db";
import { emails } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { parseRawEmailBuffer, stripHtml } from "@/lib/email-parser";

export const revalidate = 0;

function formatDate(value: string) {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;
	return new Intl.DateTimeFormat("en-US", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(date);
}

function extractBody(rawText: string) {
	const parts = rawText.split(/\r?\n\r?\n/);
	if (parts.length <= 1) return rawText;
	return parts.slice(1).join("\n\n").trim();
}

export default async function MailDetailPage({
	params,
	searchParams,
}: {
	params: Promise<{ id: string }>;
	searchParams: Promise<{ email?: string }>;
}) {
	const resolvedSearchParams = await searchParams;

	const reqHeaders = await headers();
	const session = await getAuth().api.getSession({ headers: reqHeaders });
	if (!session) redirect("/");

	const { activeEmail, needsRedirect } = await resolveActiveEmailAddress(
		session.user.id,
		resolvedSearchParams.email
	);
	if (!activeEmail) {
		redirect("/onboard");
	}

	const { id } = await params;
	if (needsRedirect) {
		redirect(`/mail/${id}?email=${encodeURIComponent(activeEmail)}`);
	}

	const email = await getEmailByIdForAddress(id, activeEmail);
	if (!email) {
		notFound();
	}

	const replyHref = `/mail/compose?email=${encodeURIComponent(activeEmail)}&mode=reply&sourceId=${encodeURIComponent(email.id)}`;
	const forwardHref = `/mail/compose?email=${encodeURIComponent(activeEmail)}&mode=forward&sourceId=${encodeURIComponent(email.id)}`;


	if (!email.read) {
		const db = getDb();
		await db.update(emails).set({ read: true }).where(eq(emails.id, id)).run();
	}

	const r2Object = await getEmailObject(email.r2_key);
	if (!r2Object) {
		notFound();
	}

	const rawBuffer = await r2Object.arrayBuffer();
	const rawPreview = new TextDecoder().decode(rawBuffer.slice(0, 50_000));
	let htmlPreview: string | undefined;
	let plainPreview = extractBody(rawPreview).slice(0, 10_000);
	try {
		const parsed = await parseRawEmailBuffer(rawBuffer);
		htmlPreview = parsed.html?.trim() || undefined;
		const parsedText = parsed.text?.trim() || (parsed.html ? stripHtml(parsed.html) : "").trim();
		if (parsedText) {
			plainPreview = parsedText;
		}
	} catch (error) {
		console.error("Failed to parse raw email with postal-mime:", error);
	}

	return (
		<>
			{/* Top Toolbars for Detail viewing */}
			<div className="flex h-12 items-center justify-between border-b border-gray-100 px-4 py-2 dark:border-gray-800">
				<div className="flex items-center gap-2">
					<Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-full">
						<Link href={`/mail?email=${encodeURIComponent(activeEmail)}`}>
							<ArrowLeft className="h-4 w-4" />
						</Link>
					</Button>
					<div className="h-4 w-px bg-gray-200 dark:bg-gray-800 mx-1" />
					<Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
						<Archive className="h-4 w-4" />
					</Button>
					<DeleteDetailButton emailId={email.id} />
					<StarButton emailId={email.id} isStarred={email.starred} />
				</div>
				<Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
					<MoreVertical className="h-4 w-4" />
				</Button>
			</div>

			{/* Detail Panel Render */}
			<div className="h-[calc(100%-48px)] overflow-y-auto p-6 flex flex-col gap-6">
				<div className="flex flex-col gap-4">
					<div className="flex items-start justify-between">
						<h1 className="text-xl font-medium tracking-tight">
							{email.subject || "(no subject)"}
						</h1>
					</div>

					<div className="flex items-center justify-between text-sm">
						<div className="flex items-center gap-3">
							<div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#0b57d0] font-semibold text-white">
								{email.from_addr?.[0].toUpperCase() ?? "S"}
							</div>
							<div className="flex flex-col">
								<div className="flex items-center gap-2">
									<span className="font-semibold">{email.from_addr}</span>
									<span className="text-xs text-muted-foreground mr-1">&lt;{email.from_addr}&gt;</span>
								</div>
								<span className="text-xs text-muted-foreground">To: {email.to_addr}</span>
							</div>
						</div>
						<div className="text-xs text-muted-foreground">
							{formatDate(email.received_at)}
						</div>
					</div>
				</div>

				<Separator className="bg-gray-100 dark:bg-gray-800" />

				{/* Content Renderers */}
				<div className="flex flex-col gap-4">
					<SanitizedEmailContent html={htmlPreview} text={plainPreview} />
				</div>

				<div className="flex gap-2 pt-4">
					<Button asChild className="flex gap-2 rounded-full h-9 px-5 outline outline-1 outline-gray-200 dark:outline-gray-800" variant="ghost">
						<Link href={replyHref}>
							<Reply className="h-4 w-4" /> Reply
						</Link>
					</Button>
					<Button asChild className="flex gap-2 rounded-full h-9 px-5 outline outline-1 outline-gray-200 dark:outline-gray-800" variant="ghost">
						<Link href={forwardHref}>
							<Forward className="h-4 w-4" /> Forward
						</Link>
					</Button>
				</div>
			</div>
		</>
	);
}
