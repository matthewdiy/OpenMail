import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { MoreVertical, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { getUserSettings } from "@/lib/user-settings";
import { EmailListPanel } from "@/components/mail/email-list-panel";
import { RefreshButton } from "@/components/mail/refresh-button";
import {
	countInboxEmailsByAddress,
	countSentEmailsByAddress,
	listDraftEmailsByAddress,
	listDistinctInboxCategoriesByAddress,
	listInboxEmailsByAddress,
	listSentEmailsByAddress,
	resolveActiveEmailAddress,
} from "@/lib/mail-store";

export const revalidate = 0;
const PAGE_SIZE = 50;

function parsePage(rawPage?: string) {
	const parsed = Number.parseInt(rawPage ?? "1", 10);
	if (!Number.isFinite(parsed) || parsed < 1) {
		return 1;
	}
	return parsed;
}

function formatDate(value: string) {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;
	return new Intl.DateTimeFormat("en-US", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(date);
}

export default async function MailPage({
	searchParams
}: {
	searchParams: Promise<{ filter?: string; email?: string; category?: string; page?: string }>
}) {
	const resolvedSearchParams = await searchParams;
	const filter = resolvedSearchParams.filter;
	const isSentFilter = filter === "sent";
	const isDraftFilter = filter === "drafts";
	const isInboxView = !filter;
	const selectedCategory = resolvedSearchParams.category?.trim();
	const page = parsePage(resolvedSearchParams.page);
	const pageNeedsCanonical = resolvedSearchParams.page !== String(page);

	const reqHeaders = await headers();
	const session = await getAuth().api.getSession({ headers: reqHeaders });
	if (!session) {
		redirect("/");
	}

	const { activeEmail, needsRedirect } = await resolveActiveEmailAddress(
		session.user.id,
		resolvedSearchParams.email
	);
	if (!activeEmail) {
		redirect("/onboard");
	}

	if (needsRedirect || pageNeedsCanonical) {
		const params = new URLSearchParams();
		params.set("email", activeEmail);
		if (filter) params.set("filter", filter);
		if (selectedCategory) params.set("category", selectedCategory);
		params.set("page", String(page));
		redirect(`/mail?${params.toString()}`);
	}

	const selectedEmail = activeEmail;
	const offset = (page - 1) * PAGE_SIZE;

	function makeMailHref(nextPage: number) {
		const params = new URLSearchParams();
		params.set("email", selectedEmail);
		params.set("page", String(nextPage));
		if (filter) params.set("filter", filter);
		if (selectedCategory) params.set("category", selectedCategory);
		return `/mail?${params.toString()}`;
	}

	let totalCount = 0;
	let emails: Awaited<ReturnType<typeof listInboxEmailsByAddress>> = [];
	let drafts: Awaited<ReturnType<typeof listDraftEmailsByAddress>> = [];

	if (isDraftFilter) {
		drafts = await listDraftEmailsByAddress(session.user.id, selectedEmail, 100);
	} else if (isSentFilter) {
		totalCount = await countSentEmailsByAddress(selectedEmail);
		emails = await listSentEmailsByAddress(selectedEmail, PAGE_SIZE, offset);
	} else {
		const mailbox = filter === "starred" ? "starred" : filter === "trash" ? "trash" : "inbox";
		totalCount = await countInboxEmailsByAddress(selectedEmail, {
			mailbox,
			category: isInboxView ? selectedCategory : undefined,
		});
		emails = await listInboxEmailsByAddress(selectedEmail, {
			mailbox,
			category: isInboxView ? selectedCategory : undefined,
			limit: PAGE_SIZE,
			offset,
		});
	}

	if (!isDraftFilter) {
		if (totalCount === 0 && page > 1) {
			redirect(makeMailHref(1));
		}
		const maxPage = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
		if (page > maxPage) {
			redirect(makeMailHref(maxPage));
		}
	}

	let availableCategories: string[] = [];
	if (isInboxView) {
		const userSettings = await getUserSettings(session.user.id);
		const configuredCategories = userSettings.mail.categories;
		const discoveredCategories = await listDistinctInboxCategoriesByAddress(selectedEmail);
		const seen = new Set<string>();
		for (const category of [...configuredCategories, ...discoveredCategories]) {
			const key = category.toLowerCase();
			if (seen.has(key)) continue;
			seen.add(key);
			availableCategories.push(category);
		}
	}

	if (!isDraftFilter) {
		return (
			<EmailListPanel
				emails={emails}
				filter={filter}
				selectedEmail={selectedEmail}
				page={page}
				pageSize={PAGE_SIZE}
				totalRows={totalCount}
				selectedCategory={selectedCategory}
				availableCategories={availableCategories}
			/>
		);
	}

	const draftCount = drafts.length;
	const draftRangeStart = draftCount > 0 ? 1 : 0;
	const draftRangeEnd = draftCount > 0 ? draftCount : 0;

	return (
		<>
			<div className="flex h-12 items-center justify-between border-b border-border px-4 py-2">
				<div className="flex items-center gap-3">
					<RefreshButton />
					<Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
						<MoreVertical className="h-4 w-4" />
					</Button>
				</div>
				<div className="flex items-center gap-3 text-xs text-muted-foreground mr-1">
					<span>{draftRangeStart}-{draftRangeEnd} of {draftCount}</span>
				</div>
			</div>

			<div className="h-[calc(100%-48px)] overflow-y-auto">
				{draftCount === 0 ? (
					<div className="flex flex-col items-center justify-center h-full text-sm text-muted-foreground gap-2">
						<p>No emails found.</p>
					</div>
				) : (
					<div className="flex flex-col">
						{drafts.map((draft) => {
							const detailHref = `/mail/compose?email=${encodeURIComponent(selectedEmail)}&draft=${encodeURIComponent(draft.id)}`;
							return (
								<Link
									key={draft.id}
									href={detailHref}
									className={cn(
										"group flex items-center gap-3 border-b border-border px-4 py-2.5 text-sm transition-colors hover:bg-accent relative"
									)}
								>
									<div className="w-48 truncate text-red-600 dark:text-red-400">
										Draft
									</div>

									<div className="flex-1 truncate flex items-center gap-2">
										<span className="text-foreground">
											{draft.subject || "(no subject)"}
										</span>
										{(draft.text || draft.to_addr) && (
											<span className="text-muted-foreground font-normal truncate">
												- {draft.to_addr ? `To: ${draft.to_addr}` : draft.text || ""}
											</span>
										)}
									</div>

									<div className="text-xs text-muted-foreground ml-4 whitespace-nowrap">
										{formatDate(draft.updated_at)}
									</div>
								</Link>
							);
						})}
					</div>
				)}
			</div>
		</>
	);
}
