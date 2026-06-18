"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ChevronLeft, ChevronRight, Mail, MailOpen, MoreVertical, RotateCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { EmailRow } from "@/lib/schema";
import {
	hardDeleteManyEmailsAction,
	hardDeleteManySentEmailsAction,
	setReadManyEmailsAction,
	softDeleteManyEmailsAction,
} from "@/app/mail/actions";
import { DeleteButton, ReadButton, RecoverButton, StarButton } from "@/components/mail/action-buttons";
import { VerificationBadge } from "@/components/mail/verification-badge";

interface EmailListPanelProps {
	emails: EmailRow[];
	filter?: string;
	selectedEmail: string;
	page: number;
	pageSize: number;
	totalRows: number;
	selectedCategory?: string;
	availableCategories: string[];
}

function formatDate(value: string) {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;
	return new Intl.DateTimeFormat("en-US", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(date);
}

function isNewEmail(value: string) {
	const timestamp = new Date(value).getTime();
	if (Number.isNaN(timestamp)) return false;
	return Date.now() - timestamp < 1000 * 60 * 60 * 24;
}

export function EmailListPanel({
	emails,
	filter,
	selectedEmail,
	page,
	pageSize,
	totalRows,
	selectedCategory,
	availableCategories,
}: EmailListPanelProps) {
	const router = useRouter();
	const [isPending, startTransition] = React.useTransition();
	const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
	const overallCheckboxRef = React.useRef<HTMLInputElement>(null);

	const isSentFilter = filter === "sent";
	const isTrashFilter = filter === "trash";
	const isInboxView = !filter;
	const offset = (page - 1) * pageSize;

	const rangeStart = totalRows === 0 ? 0 : offset + 1;
	const rangeEnd = totalRows === 0 ? 0 : offset + emails.length;
	const hasPrev = page > 1;
	const hasNext = rangeEnd < totalRows;

	const selectedEmails = React.useMemo(
		() => emails.filter((email) => selectedIds.has(email.id)),
		[emails, selectedIds]
	);
	const selectedCount = selectedEmails.length;
	const hasAnySelected = selectedCount > 0;
	const allSelected = emails.length > 0 && selectedCount === emails.length;
	const shouldMarkAsRead = selectedEmails.some((email) => !email.read);

	React.useEffect(() => {
		setSelectedIds(new Set());
	}, [emails]);

	React.useEffect(() => {
		if (!overallCheckboxRef.current) return;
		overallCheckboxRef.current.indeterminate = hasAnySelected && !allSelected;
	}, [hasAnySelected, allSelected]);

	function pageHref(nextPage: number) {
		const params = new URLSearchParams();
		params.set("email", selectedEmail);
		params.set("page", String(nextPage));
		if (filter) params.set("filter", filter);
		if (selectedCategory) params.set("category", selectedCategory);
		return `/mail?${params.toString()}`;
	}

	function categoryHref(category: string) {
		const params = new URLSearchParams();
		params.set("email", selectedEmail);
		params.set("page", "1");
		if (category.toLowerCase() !== "all") {
			params.set("category", category);
		}
		return `/mail?${params.toString()}`;
	}

	function toggleOne(id: string, checked: boolean) {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (checked) {
				next.add(id);
			} else {
				next.delete(id);
			}
			return next;
		});
	}

	function handleBulkDelete() {
		const emailIds = Array.from(selectedIds);
		if (emailIds.length === 0) return;

		startTransition(() => {
			void (async () => {
				if (isSentFilter) {
					await hardDeleteManySentEmailsAction(emailIds);
				} else if (isTrashFilter) {
					await hardDeleteManyEmailsAction(emailIds);
				} else {
					await softDeleteManyEmailsAction(emailIds);
				}
				setSelectedIds(new Set());
				router.refresh();
			})();
		});
	}

	function handleBulkReadToggle() {
		if (isSentFilter) return;
		const emailIds = Array.from(selectedIds);
		if (emailIds.length === 0) return;

		startTransition(() => {
			void (async () => {
				await setReadManyEmailsAction(emailIds, shouldMarkAsRead);
				setSelectedIds(new Set());
				router.refresh();
			})();
		});
	}

	return (
		<>
			<div className="flex h-12 items-center justify-between border-b border-border px-4 py-2">
				<div className="flex items-center gap-2">
					<input
						ref={overallCheckboxRef}
						type="checkbox"
						className="h-4 w-4 rounded border-gray-300"
						checked={allSelected}
						onChange={(e) => {
							if (e.target.checked) {
								setSelectedIds(new Set(emails.map((email) => email.id)));
							} else {
								setSelectedIds(new Set());
							}
						}}
					/>
					{hasAnySelected ? (
						<>
							<Button
								variant="ghost"
								size="icon"
								className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
								disabled={isPending}
								onClick={handleBulkDelete}
								aria-label={isTrashFilter ? "Permanently delete selected emails" : "Delete selected emails"}
							>
								<Trash2 className="h-4 w-4" />
							</Button>
							{!isSentFilter ? (
								<Button
									variant="ghost"
									size="icon"
									className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
									disabled={isPending}
									onClick={handleBulkReadToggle}
									aria-label={shouldMarkAsRead ? "Mark selected as read" : "Mark selected as unread"}
								>
									{shouldMarkAsRead ? <MailOpen className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
								</Button>
							) : null}
						</>
					) : null}
					<Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => router.refresh()} title="Refresh">
						<RotateCw className="h-4 w-4" />
					</Button>
					<Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
						<MoreVertical className="h-4 w-4" />
					</Button>
				</div>
				<div className="flex items-center gap-3 text-xs text-muted-foreground mr-1">
					<span>{rangeStart}-{rangeEnd} of {totalRows}</span>
					{hasPrev ? (
						<Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-full">
							<Link href={pageHref(page - 1)}>
								<ChevronLeft className="h-4 w-4" />
							</Link>
						</Button>
					) : (
						<Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" disabled>
							<ChevronLeft className="h-4 w-4" />
						</Button>
					)}
					{hasNext ? (
						<Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-full">
							<Link href={pageHref(page + 1)}>
								<ChevronRight className="h-4 w-4" />
							</Link>
						</Button>
					) : (
						<Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" disabled>
							<ChevronRight className="h-4 w-4" />
						</Button>
					)}
				</div>
			</div>

			<div className="h-[calc(100%-48px)] overflow-y-auto">
				{isInboxView ? (
					<div className="border-b border-border px-4 py-2">
						<div className="overflow-x-auto">
							<div className="flex min-w-max items-center gap-2">
								<Link
									href={categoryHref("all")}
									className={cn(
										"rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
										!selectedCategory || selectedCategory.toLowerCase() === "all"
											? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300"
											: "border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-900/40"
									)}
								>
									All
								</Link>
								{availableCategories.map((category) => (
									<Link
										key={category}
										href={categoryHref(category)}
										className={cn(
											"rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
											selectedCategory?.toLowerCase() === category.toLowerCase()
												? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300"
												: "border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-900/40"
										)}
									>
										{category}
									</Link>
								))}
							</div>
						</div>
					</div>
				) : null}

				{emails.length === 0 ? (
					<div className="flex flex-col items-center justify-center h-full text-sm text-muted-foreground gap-2">
						<p>No emails found.</p>
					</div>
				) : (
					<div className="flex flex-col">
						{emails.map((email) => {
							const showNew = isNewEmail(email.received_at);
							const detailHref = isSentFilter
								? `/mail/sent/${email.id}?email=${encodeURIComponent(selectedEmail)}`
								: `/mail/${email.id}?email=${encodeURIComponent(selectedEmail)}`;
							return (
								<Link
									key={email.id}
									href={detailHref}
									className={cn(
										"group flex items-center gap-3 border-b border-border px-4 py-2.5 text-sm transition-colors hover:bg-accent relative",
										!email.read && "font-semibold bg-background",
										email.read && "text-muted-foreground opacity-85"
									)}
								>
									<div className="flex items-center gap-2 z-10">
										<input
											type="checkbox"
											className="h-4 w-4 rounded border-gray-300 dark:border-gray-700"
											checked={selectedIds.has(email.id)}
											onClick={(e) => {
												e.stopPropagation();
											}}
											onChange={(e) => {
												toggleOne(email.id, e.target.checked);
											}}
										/>
										{!isSentFilter ? (
											<StarButton emailId={email.id} isStarred={email.starred} />
										) : null}
									</div>

									<div className="w-48 truncate">
										{isSentFilter ? `To: ${email.to_addr}` : email.from_addr}
									</div>

									<div className="flex-1 truncate flex items-center gap-2">
										{email.category && (
											<span className="rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-medium text-blue-600 dark:bg-blue-950/30 dark:text-blue-400 border border-blue-100 dark:border-blue-900/40">
												{email.category}
											</span>
										)}
										<span className={cn(showNew ? "text-foreground" : "text-muted-foreground")}>
											{email.subject || "(no subject)"}
										</span>
										{email.verification_code ? (
											<VerificationBadge code={email.verification_code} />
										) : (
											(email.summary || email.snippet) && (
												<span className="text-muted-foreground font-normal truncate">
													- {email.summary || email.snippet}
												</span>
											)
										)}
									</div>

									{!isSentFilter ? (
										<div className="absolute right-16 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-1 bg-background/90 p-1 rounded-full px-2 z-10 backdrop-blur-sm">
											<Button variant="ghost" size="icon" className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground">
												<Archive className="h-4 w-4" />
											</Button>
											{isTrashFilter ? (
												<RecoverButton emailId={email.id} />
											) : (
												<DeleteButton emailId={email.id} isDeleted={email.deleted} />
											)}
											<ReadButton emailId={email.id} isRead={email.read} />
										</div>
									) : null}

									<div className="text-xs text-muted-foreground ml-4 whitespace-nowrap group-hover:invisible">
										{formatDate(email.received_at)}
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
