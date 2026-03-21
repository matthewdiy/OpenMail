"use client";

import { useTransition } from "react";
import { Star, Trash2, RotateCcw, Mail, MailOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toggleStarAction, toggleDeleteAction, toggleReadAction } from "@/app/mail/actions";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

export function StarButton({ emailId, isStarred }: { emailId: string; isStarred: boolean }) {
	const [isPending, startTransition] = useTransition();

	return (
		<Button 
			variant="ghost" 
			size="icon" 
			className="h-7 w-7 rounded-full p-0"
			disabled={isPending}
			onClick={(e) => {
				e.preventDefault();
				e.stopPropagation();
				startTransition(() => {
					toggleStarAction(emailId, isStarred);
				});
			}}
		>
			<Star className={cn("h-4 w-4 text-gray-400 hover:text-amber-400 transition-colors", isStarred && "fill-amber-400 text-amber-400")} />
		</Button>
	);
}

export function DeleteButton({ emailId, isDeleted }: { emailId: string; isDeleted: boolean }) {
	const [isPending, startTransition] = useTransition();

	return (
		<Button 
			variant="ghost" 
			size="icon" 
			className="h-7 w-7 rounded-full p-0"
			disabled={isPending}
			onClick={(e) => {
				e.preventDefault();
				e.stopPropagation();
				startTransition(() => {
					toggleDeleteAction(emailId, isDeleted);
				});
			}}
		>
			<Trash2 className="h-4 w-4 text-gray-500 hover:text-black" />
		</Button>
	);
}

export function DeleteDetailButton({ emailId }: { emailId: string }) {
	const [isPending, startTransition] = useTransition();
	const router = useRouter();

	return (
		<Button 
			variant="ghost" 
			size="icon" 
			className="h-8 w-8 rounded-full"
			disabled={isPending}
			onClick={(e) => {
				e.preventDefault();
				startTransition(async () => {
					await toggleDeleteAction(emailId, false);
					router.push("/mail");
				});
			}}
		>
			<Trash2 className="h-4 w-4" />
		</Button>
	);
}
export function RecoverButton({ emailId }: { emailId: string }) {
	const [isPending, startTransition] = useTransition();

	return (
		<Button 
			variant="ghost" 
			size="icon" 
			className="h-7 w-7 rounded-full p-0"
			disabled={isPending}
			onClick={(e) => {
				e.preventDefault();
				e.stopPropagation();
				startTransition(() => {
					toggleDeleteAction(emailId, true);
				});
			}}
		>
			<RotateCcw className="h-4 w-4 text-green-600 hover:text-green-700" />
		</Button>
	);
}

export function ReadButton({ emailId, isRead }: { emailId: string; isRead: boolean }) {
	const [isPending, startTransition] = useTransition();

	return (
		<Button
			variant="ghost"
			size="icon"
			className="h-7 w-7 rounded-full p-0 text-gray-500 hover:text-black"
			disabled={isPending}
			onClick={(e) => {
				e.preventDefault();
				e.stopPropagation();
				startTransition(() => {
					toggleReadAction(emailId, isRead);
				});
			}}
			aria-label={isRead ? "Mark as unread" : "Mark as read"}
		>
			{isRead ? <MailOpen className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
		</Button>
	);
}
