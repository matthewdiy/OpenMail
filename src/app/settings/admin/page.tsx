import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { asc, eq, isNull, ne, or } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { getAuth } from "@/lib/auth";
import { user } from "@/lib/auth-schema";
import { getDb } from "@/lib/db";
import { userEmailQuotas } from "@/lib/schema";
import { DEFAULT_EMAIL_ACCOUNT_QUOTA } from "@/lib/user-access";
import { buildSystemConfigV1FromEnv, getSystemConfig } from "@/lib/system-config";
import { updateMailSystemConfigAction, updateUserEmailQuotaAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MailProviderConfigForm } from "./mail-provider-config-form";

export const revalidate = 0;

export default async function AdminSettingsPage() {
	const reqHeaders = await headers();
	const session = await getAuth().api.getSession({ headers: reqHeaders });
	if (!session) {
		redirect("/");
	}
	if (session.user.role !== "admin") {
		notFound();
	}

	const db = getDb();
	const currentSystemConfig = await getSystemConfig();
	const initialMailConfig = currentSystemConfig ?? buildSystemConfigV1FromEnv();
	const sourceLabel = currentSystemConfig ? "D1 system_config" : "environment fallback preview";
	const allowLocalProvider = process.env.NODE_ENV === "development";

	const users = await db
		.select({
			id: user.id,
			name: user.name,
			email: user.email,
			role: user.role,
			quota: userEmailQuotas.quota,
		})
		.from(user)
		.leftJoin(userEmailQuotas, eq(user.id, userEmailQuotas.userId))
		.where(or(ne(user.role, "admin"), isNull(user.role)))
		.orderBy(asc(user.email))
		.all();

	return (
		<>
			<div className="flex h-12 items-center gap-3 border-b border-gray-100 px-4 py-2 dark:border-gray-800">
				<Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-full">
					<Link href="/settings">
						<ArrowLeft className="h-4 w-4" />
					</Link>
				</Button>
				<h1 className="text-base font-semibold">Admin Settings</h1>
			</div>

			<div className="p-6 max-w-4xl flex flex-col gap-6">
				<MailProviderConfigForm
					initialConfig={initialMailConfig}
					saveAction={updateMailSystemConfigAction}
					sourceLabel={sourceLabel}
					allowLocalProvider={allowLocalProvider}
				/>

				<div className="space-y-1">
					<h2 className="text-lg font-medium">User Email Account Quotas</h2>
					<p className="text-sm text-muted-foreground">
						Default quota is {DEFAULT_EMAIL_ACCOUNT_QUOTA}. Admin users always have unlimited
						email addresses.
					</p>
				</div>

				{users.length === 0 ? (
					<div className="rounded-lg border border-gray-200 p-4 text-sm text-muted-foreground dark:border-gray-800">
						No normal users found.
					</div>
				) : (
					<div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
						<table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
							<thead>
								<tr className="bg-gray-50 dark:bg-neutral-900/40">
									<th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
										User
									</th>
									<th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
										Role
									</th>
									<th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
										Quota
									</th>
									<th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
										Action
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-gray-100 dark:divide-gray-800">
								{users.map((row) => (
									<tr key={row.id}>
										<td className="px-4 py-3 text-sm">
											<div className="font-medium">{row.name || "Unknown User"}</div>
											<div className="text-xs text-muted-foreground">{row.email}</div>
										</td>
										<td className="px-4 py-3 text-sm text-muted-foreground">{row.role || "user"}</td>
										<td className="px-4 py-3">
											<form action={updateUserEmailQuotaAction} className="flex items-center gap-2">
												<input type="hidden" name="userId" value={row.id} />
												<Input
													type="number"
													name="quota"
													min={DEFAULT_EMAIL_ACCOUNT_QUOTA}
													defaultValue={row.quota ?? DEFAULT_EMAIL_ACCOUNT_QUOTA}
													className="h-9 w-24"
													required
												/>
												<Button type="submit" size="sm">
													Save
												</Button>
											</form>
										</td>
										<td className="px-4 py-3 text-xs text-muted-foreground">
											Applies when linking new email accounts.
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</div>
		</>
	);
}
