"use client";
import * as React from "react";
import {
	Inbox, Star, Clock, Send, File, Trash,
	Search, Menu, Settings, HelpCircle, LayoutGrid, Plus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { ProfileDropdown } from "./profile-dropdown";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

interface MainLayoutProps {
	children: React.ReactNode;
	userName?: string;
	userEmail?: string;
	userImage?: string;
	userEmailAccounts?: string[];
}

export function MainLayout({ children, userName, userEmail, userImage, userEmailAccounts }: MainLayoutProps) {
	const searchParams = useSearchParams();
	const router = useRouter();
	const pathname = usePathname();
	const filter = searchParams?.get("filter");
	const selectedEmail = searchParams?.get("email") || userEmailAccounts?.[0] || "";

	function withSelectedEmail(href: string, resetPage = false) {
		if (!selectedEmail) return href;
		const [basePath, query = ""] = href.split("?");
		const params = new URLSearchParams(query);
		params.set("email", selectedEmail);
		if (resetPage && basePath === "/mail") {
			params.set("page", "1");
		}
		const nextQuery = params.toString();
		return nextQuery ? `${basePath}?${nextQuery}` : basePath;
	}

	return (
		<div className="flex h-screen flex-col overflow-hidden bg-[#f6f8fc] text-[#1f1f1f] dark:bg-[#0b0c10] dark:text-[#e3e3e3]">
			{/* Top bar */}
			<header className="flex h-16 items-center justify-between px-4">
				<div className="flex items-center gap-2">
					<Button variant="ghost" size="icon" className="rounded-full">
						<Menu className="h-5 w-5" />
					</Button>
					<Link href={withSelectedEmail("/mail", true)} className="flex items-center gap-2 px-2">
						<span className="text-xl font-medium tracking-tight text-[#444746] dark:text-[#c4c7c5]">OpenMail</span>
					</Link>
				</div>

				<div className="flex flex-1 max-w-3xl px-4">
					<div className="relative w-full">
						<Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#444746] dark:text-[#c4c7c5]" />
						<Input
							placeholder="Search mail"
							className="h-12 w-full rounded-full border-none bg-[#eaf1fb] pl-12 pr-4 text-sm focus-visible:ring-1 focus-visible:ring-[#0b57d0] dark:bg-[#1e2024] dark:focus-visible:ring-[#a8c7fa]"
						/>
					</div>
				</div>

				<div className="flex items-center gap-2">
					<Button variant="ghost" size="icon" className="rounded-full">
						<HelpCircle className="h-5 w-5" />
					</Button>
					<Link href="/settings">
						<Button variant="ghost" size="icon" className="rounded-full">
							<Settings className="h-5 w-5" />
						</Button>
					</Link>
					{/* <Button variant="ghost" size="icon" className="rounded-full">
						<LayoutGrid className="h-5 w-5" />
					</Button> */}
					<ProfileDropdown userName={userName} userEmail={userEmail} userImage={userImage} />
				</div>
			</header>

			{/* Main body split */}
			<div className="flex flex-1 overflow-hidden">
				{/* Sidebar */}
				<aside className="flex w-64 flex-col px-3 py-2">
					<Button asChild className="mb-4 flex gap-2 rounded-2xl bg-[#c2e7ff] p-6 text-sm font-semibold text-[#001d35] shadow-sm hover:bg-[#b3dcfa] dark:bg-[#004a77] dark:text-[#c2e7ff] h-14 w-fit px-5">
						<Link href={withSelectedEmail("/mail/compose")}>
							<Plus className="h-5 w-5" />
							Compose
						</Link>
					</Button>

					<nav className="flex flex-col gap-1 flex-1">
						<SidebarItem href={withSelectedEmail("/mail", true)} icon={<Inbox className="h-5 w-5" />} label="Inbox" active={!filter} />
						<SidebarItem href={withSelectedEmail("/mail?filter=starred", true)} icon={<Star className="h-5 w-5" />} label="Starred" active={filter === "starred"} />
						<SidebarItem href="#" icon={<Clock className="h-5 w-5" />} label="Snoozed" />
						<SidebarItem href={withSelectedEmail("/mail?filter=sent", true)} icon={<Send className="h-5 w-5" />} label="Sent" active={filter === "sent"} />
						<SidebarItem href={withSelectedEmail("/mail?filter=drafts", true)} icon={<File className="h-5 w-5" />} label="Drafts" active={filter === "drafts"} />
						<SidebarItem href={withSelectedEmail("/mail?filter=trash", true)} icon={<Trash className="h-5 w-5" />} label="Trash" active={filter === "trash"} />
					</nav>

					{userEmailAccounts && userEmailAccounts.length > 0 && (
						<div className="mt-auto border-t border-gray-100 pt-4 dark:border-gray-800">
							<div className="px-2 mb-2 text-xs font-semibold text-gray-400 dark:text-gray-500">
								Account View
							</div>
							<Select 
								defaultValue={selectedEmail}
								onValueChange={(val) => {
									const params = new URLSearchParams(window.location.search);
									if (val) {
										params.set("email", val);
									}
									params.set("page", "1");
									router.push(`${pathname}?${params.toString()}`);
								}}
							>
								<SelectTrigger className="w-full bg-white dark:bg-neutral-900 border-none shadow-none text-xs h-9 rounded-xl">
									<SelectValue placeholder="Select email" />
								</SelectTrigger>
								<SelectContent>
									{userEmailAccounts.map((account) => (
										<SelectItem key={account} value={account} className="text-xs">
											{account}
										</SelectItem>
									))}
								</SelectContent>
							</Select>

						</div>
					)}
				</aside>

				{/* Main Content Pane */}
				<main className="flex-1 overflow-hidden m-2 ml-0 rounded-2xl bg-white shadow-sm dark:bg-[#14151a] border border-gray-100 dark:border-gray-900">
					{children}
				</main>
			</div>
		</div>
	);
}

function SidebarItem({ href, icon, label, count, active }: { href: string; icon: React.ReactNode; label: string; count?: number; active?: boolean }) {
	return (
		<Link
			href={href}
			className={cn(
				"flex items-center justify-between rounded-full px-4 py-2 text-sm font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/5",
				active && "bg-[#d3e3fd] text-[#041e49] dark:bg-[#004a77] dark:text-[#c2e7ff] font-semibold"
			)}
		>
			<div className="flex items-center gap-4">
				<div className={cn("text-[#444746] dark:text-[#c4c7c5]", active && "text-[#001d35] dark:text-[#c2e7ff]")}>
					{icon}
				</div>
				<span>{label}</span>
			</div>
			{count ? <span className="text-xs font-semibold">{count}</span> : null}
		</Link>
	);
}
