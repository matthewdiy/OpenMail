import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateExpireSettingsAction, updateCategoriesAction } from "./actions";
import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { formatUserCategories, getUserSettings } from "@/lib/user-settings";

export const revalidate = 0;

export default async function SettingsPage() {
	const reqHeaders = await headers();
	const session = await getAuth().api.getSession({ headers: reqHeaders });
	if (!session) redirect("/");

	const isAdmin = session.user.role === "admin";
	const userSettings = await getUserSettings(session.user.id);
	const currentExpireDays = userSettings.mail.trashExpireDays;
	const currentCategories = formatUserCategories(userSettings.mail.categories);

	async function handleSubmit(formData: FormData) {
		"use server";
		const days = parseInt(formData.get("trash_expire_days") as string);
		const categories = formData.get("email_categories") as string;
		if (!isNaN(days)) {
			await updateExpireSettingsAction(days);
		}
		if (categories) {
			await updateCategoriesAction(categories);
		}
	}

	return (
		<>
			<div className="flex h-12 items-center border-b border-gray-100 px-4 py-2 dark:border-gray-800">
				<h1 className="text-base font-semibold">Settings</h1>
			</div>

			<div className="p-6 max-w-md flex flex-col gap-6">
					<div className="space-y-1 mb-2 pb-6 border-b border-gray-100 dark:border-gray-800">
						<h2 className="text-lg font-medium">Email Accounts</h2>
						<p className="text-sm text-muted-foreground mb-4">Link addresses to receive mail into your account.</p>
						<Button asChild variant="outline">
							<Link href="/settings/accounts">Manage Email Accounts</Link>
						</Button>
					</div>
					{isAdmin ? (
						<div className="space-y-1 mb-2 pb-6 border-b border-gray-100 dark:border-gray-800">
							<h2 className="text-lg font-medium">Admin Controls</h2>
							<p className="text-sm text-muted-foreground mb-4">
								Manage per-user email account quotas.
							</p>
							<Button asChild variant="outline">
								<Link href="/settings/admin">Open Admin Settings</Link>
							</Button>
						</div>
					) : null}

				<div className="space-y-1">
					<h2 className="text-lg font-medium">Trash Expiry</h2>
					<p className="text-sm text-muted-foreground">Automatically delete emails from the trash after a set number of days.</p>
				</div>

				<form action={handleSubmit} className="flex flex-col gap-4">
					<div className="flex flex-col gap-2">
						<label htmlFor="trash_expire_days" className="text-sm font-medium">Auto-delete after (days)</label>
						<Input 
							type="number" 
							id="trash_expire_days" 
							name="trash_expire_days" 
							defaultValue={currentExpireDays} 
							min={1} 
							max={365}
							required
							className="max-w-[120px]"
						/>
					</div>
					<div className="flex flex-col gap-2">
						<label htmlFor="email_categories" className="text-sm font-medium">Email Categories (comma-separated)</label>
						<Input 
							type="text" 
							id="email_categories" 
							name="email_categories" 
							defaultValue={currentCategories} 
							required
							className="max-w-md"
						/>
						<p className="text-xs text-muted-foreground">Used by AI to classify incoming emails.</p>
					</div>
					<Button type="submit" className="w-fit">Save Settings</Button>
				</form>
			</div>
		</>
	);
}
