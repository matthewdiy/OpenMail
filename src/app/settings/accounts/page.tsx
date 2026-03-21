import { getDb } from "@/lib/db";
import { userEmails } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addEmailAccountAction, deleteEmailAccountAction } from "./actions";
import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Trash, ArrowLeft } from "lucide-react";
import Link from "next/link";

export const revalidate = 0;

export default async function AccountsPage() {
	const reqHeaders = await headers();
	const session = await getAuth().api.getSession({ headers: reqHeaders });
	if (!session) redirect("/");

	const db = getDb();
	const accounts = await db.select().from(userEmails).where(eq(userEmails.userId, session.user.id)).all();

	async function handleAdd(formData: FormData) {
		"use server";
		const email = formData.get("emailAddress") as string;
		if (email) {
			await addEmailAccountAction(email);
		}
	}

	async function handleDelete(formData: FormData) {
		"use server";
		const email = formData.get("emailAddress") as string;
		if (email) {
			await deleteEmailAccountAction(email);
		}
	}

	return (
		<>
			<div className="flex h-12 items-center gap-3 border-b border-gray-100 px-4 py-2 dark:border-gray-800">
				<Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-full">
					<Link href="/settings">
						<ArrowLeft className="h-4 w-4" />
					</Link>
				</Button>
				<h1 className="text-base font-semibold">Email Accounts</h1>
			</div>

			<div className="p-6 max-w-2xl flex flex-col gap-8">
				<div className="space-y-1">
					<h2 className="text-lg font-medium">Linked Email Addresses</h2>
					<p className="text-sm text-muted-foreground">Manage the email addresses associated with your account. Incoming emails to these addresses will be routed to your inbox.</p>
				</div>

					<div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
						{accounts.length === 0 ? (
							<div className="p-4 py-8 text-sm text-muted-foreground text-center space-y-3">
								<p>No email addresses linked yet.</p>
								<Button asChild size="sm" variant="outline">
									<Link href="/onboard">Set up your first email</Link>
								</Button>
							</div>
						) : (
						<div className="flex flex-col">
							{accounts.map(account => (
								<div key={account.emailAddress} className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-neutral-900/40">
									<div className="text-sm font-medium">{account.emailAddress}</div>
									<form action={handleDelete}>
										<input type="hidden" name="emailAddress" value={account.emailAddress} />
										<Button type="submit" variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30">
											<Trash className="h-4 w-4" />
										</Button>
									</form>
								</div>
							))}
						</div>
					)}
				</div>

					<div className="pt-2">
						<h3 className="text-sm font-medium mb-3">Add New Email Address</h3>
						<form action={handleAdd} className="flex gap-3 items-end">
							<div className="flex flex-col gap-2 flex-1 max-w-sm">
								<Input
									type="email"
									name="emailAddress"
									placeholder="example@yourdomain.com"
									required
								/>
							</div>
							<Button type="submit" className="bg-[#0b57d0] hover:bg-[#0842a0] text-white dark:bg-[#a8c7fa] dark:hover:bg-[#8ab4f8] dark:text-[#041e49]">
								Link Email
							</Button>
						</form>
						<p className="mt-2 text-xs text-muted-foreground">Your account linking quota is enforced by policy.</p>
					</div>
				</div>
			</>
		);
}
