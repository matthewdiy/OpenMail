"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { LogOut, Settings } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export function ProfileDropdown({
	userName,
	userEmail,
	userImage
}: {
	userName?: string;
	userEmail?: string;
	userImage?: string;
}) {
	const [isOpen, setIsOpen] = React.useState(false);
	const dropdownRef = React.useRef<HTMLDivElement>(null);
	const router = useRouter();

	React.useEffect(() => {
		function handleClickOutside(event: MouseEvent) {
			if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
				setIsOpen(false);
			}
		}
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	const handleSignOut = async () => {
		await authClient.signOut();
		router.push("/");
		router.refresh();
	};

	return (
		<div className="relative" ref={dropdownRef}>
			<button
				onClick={() => setIsOpen(!isOpen)}
				className="ml-2 flex h-8 w-8 items-center justify-center rounded-full bg-[#0b57d0] text-sm font-medium text-white overflow-hidden cursor-pointer hover:ring-2 hover:ring-[#0b57d0]/20 focus:outline-none"
			>
				{userImage ? (
					<img src={userImage} alt={userName || "avatar"} className="h-full w-full object-cover" />
				) : (
					<span>{userName?.[0].toUpperCase() ?? userEmail?.[0].toUpperCase() ?? "U"}</span>
				)}
			</button>

			{isOpen && (
				<div className="absolute right-0 mt-2 w-72 rounded-2xl bg-white p-4 shadow-xl ring-1 ring-black/5 dark:bg-[#1a1c21] dark:ring-white/10 z-50">
					<div className="flex flex-col items-center gap-2 pb-4 border-b border-gray-100 dark:border-gray-800">
						{/* <div className="flex flex-col"> */}
						<span className="font-semibold text-base text-gray-900 dark:text-gray-100">{userName || "User"}</span>
						<span className="text-xs text-muted-foreground">{userEmail}</span>
						{/* </div> */}
					</div>

					<div className="pt-2 flex flex-col gap-1">
						<Link href="/settings" onClick={() => setIsOpen(false)}>
							<div className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5 cursor-pointer">
								<Settings className="h-4 w-4" />
								<span>Settings</span>
							</div>
						</Link>
						<div
							onClick={handleSignOut}
							className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 cursor-pointer"
						>
							<LogOut className="h-4 w-4" />
							<span>Sign out</span>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
