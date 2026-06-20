import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SanitizedEmailContent } from "@/components/mail/sanitized-email-content";
import { getAuth } from "@/lib/auth";
import { getSentEmailByIdForAddress, resolveActiveEmailAddress } from "@/lib/mail-store";

export const revalidate = 0;

function formatDate(value: string) {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;
	return new Intl.DateTimeFormat("en-US", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(date);
}

export default async function SentMailDetailPage({
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
		redirect(`/mail/sent/${id}?email=${encodeURIComponent(activeEmail)}`);
	}

	const email = await getSentEmailByIdForAddress(id, activeEmail);
	if (!email) {
		notFound();
	}

	return (
		<>
			<div className="flex h-12 items-center border-b border-gray-100 px-4 py-2 dark:border-gray-800">
				<Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-full">
					<Link href={`/mail?filter=sent&email=${encodeURIComponent(activeEmail)}`}>
						<ArrowLeft className="h-4 w-4" />
					</Link>
				</Button>
				<h1 className="ml-2 text-base font-semibold">Sent message</h1>
			</div>

			<div className="h-[calc(100%-48px)] overflow-y-auto p-6">
				<div className="space-y-3">
					<h2 className="text-xl font-semibold">{email.subject || "(no subject)"}</h2>
					<div className="text-sm text-muted-foreground">
						<p>From: {email.from_addr}</p>
						<p>To: {email.to_addr}</p>
						<p>{formatDate(email.received_at)}</p>
					</div>
				</div>
				<Separator className="my-6 bg-gray-100 dark:bg-gray-800" />
				<SanitizedEmailContent
					html={email.html ?? undefined}
					text={email.text || email.snippet || "No body preview available for this sent message."}
				/>
			</div>
		</>
	);
}
