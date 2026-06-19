import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ArrowLeft, KeyRound, Plus, Trash } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getAuth } from "@/lib/auth";
import { createApiKeyAction, deleteApiKeyAction } from "./actions";

export const revalidate = 0;

function formatDate(value: Date | string | null | undefined) {
	if (!value) return "Never";
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) return "Unknown";
	return new Intl.DateTimeFormat("en-US", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(date);
}

export default async function ApiKeySettingsPage({
	searchParams,
}: {
	searchParams: Promise<{ created?: string }>;
}) {
	const resolvedSearchParams = await searchParams;
	const reqHeaders = await headers();
	const session = await getAuth().api.getSession({ headers: reqHeaders });
	if (!session) redirect("/");

	const result = await getAuth().api.listApiKeys({
		headers: reqHeaders,
		query: {
			sortBy: "createdAt",
			sortDirection: "desc",
			limit: 100,
		},
	});
	const apiKeys = result.apiKeys;

	return (
		<>
			<div className="flex h-12 items-center gap-3 border-b border-gray-100 px-4 py-2 dark:border-gray-800">
				<Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-full">
					<Link href="/settings" aria-label="Back to settings">
						<ArrowLeft className="h-4 w-4" />
					</Link>
				</Button>
				<h1 className="text-base font-semibold">API Keys</h1>
			</div>

			<div className="flex max-w-3xl flex-col gap-6 p-6">
				<Card className="rounded-lg">
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-lg">
							<KeyRound className="h-5 w-5" />
							Create API Key
						</CardTitle>
						<CardDescription>
							Use API keys to access OpenMail endpoints from scripts and external tools.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						{resolvedSearchParams.created ? (
							<div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm dark:border-green-900 dark:bg-green-950/30">
								<div className="font-medium text-green-900 dark:text-green-100">
									Copy this key now. It will not be shown again.
								</div>
								<code className="mt-3 block overflow-x-auto rounded-md bg-white p-3 text-xs text-green-950 dark:bg-neutral-950 dark:text-green-100">
									{resolvedSearchParams.created}
								</code>
							</div>
						) : null}

						<form action={createApiKeyAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
							<div className="flex flex-1 flex-col gap-2">
								<label htmlFor="name" className="text-sm font-medium">
									Key name
								</label>
								<Input id="name" name="name" placeholder="Production integration" maxLength={80} />
							</div>
							<Button type="submit" className="w-fit">
								<Plus className="h-4 w-4" />
								Create Key
							</Button>
						</form>
					</CardContent>
				</Card>

				<Card className="rounded-lg">
					<CardHeader>
						<CardTitle className="text-lg">Existing Keys</CardTitle>
						<CardDescription>
							Revoke keys that are no longer used by your integrations.
						</CardDescription>
					</CardHeader>
					<CardContent>
						{apiKeys.length === 0 ? (
							<div className="rounded-lg border border-dashed border-gray-200 p-8 text-center text-sm text-muted-foreground dark:border-gray-800">
								No API keys created yet.
							</div>
						) : (
							<div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
								{apiKeys.map((apiKey) => (
									<div
										key={apiKey.id}
										className="flex flex-col gap-3 border-b border-gray-100 p-4 last:border-0 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between"
									>
										<div className="min-w-0 space-y-1">
											<div className="flex flex-wrap items-center gap-2">
												<div className="truncate text-sm font-medium">
													{apiKey.name || "Untitled key"}
												</div>
												{apiKey.enabled ? (
													<Badge variant="secondary">Active</Badge>
												) : (
													<Badge variant="outline">Disabled</Badge>
												)}
											</div>
											<div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
												<span>
													Identifier:{" "}
													<code>{apiKey.prefix || apiKey.start || apiKey.id.slice(0, 8)}</code>
												</span>
												<span>Created: {formatDate(apiKey.createdAt)}</span>
												<span>Expires: {formatDate(apiKey.expiresAt)}</span>
											</div>
										</div>
										<form action={deleteApiKeyAction}>
											<input type="hidden" name="keyId" value={apiKey.id} />
											<Button
												type="submit"
												variant="ghost"
												size="icon"
												className="h-8 w-8 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
												aria-label={`Delete ${apiKey.name || "API key"}`}
											>
												<Trash className="h-4 w-4" />
											</Button>
										</form>
									</div>
								))}
							</div>
						)}
					</CardContent>
				</Card>
			</div>
		</>
	);
}
