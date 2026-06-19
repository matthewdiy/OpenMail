import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { userEmails } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { addEmailAccountAction } from "@/app/settings/accounts/actions";

type OnboardPageProps = {
	searchParams: Promise<{
		error?: string | string[];
	}>;
};

function getParamValue(value?: string | string[]) {
	if (!value) return undefined;
	return Array.isArray(value) ? value[0] : value;
}

export default async function OnboardPage({ searchParams }: OnboardPageProps) {
	const reqHeaders = await headers();
	const session = await getAuth().api.getSession({ headers: reqHeaders });
	if (!session) {
		redirect("/");
	}

	const db = getDb();
	const linkedEmails = await db
		.select({ emailAddress: userEmails.emailAddress })
		.from(userEmails)
		.where(eq(userEmails.userId, session.user.id))
		.limit(1)
		.all();
	if (linkedEmails.length > 0) {
		redirect("/mail");
	}

	const resolvedSearchParams = await searchParams;
	const errorMessage = getParamValue(resolvedSearchParams.error);

	async function handleSubmit(formData: FormData) {
		"use server";
		const emailAddress = String(formData.get("emailAddress") ?? "");
		try {
			await addEmailAccountAction(emailAddress);
			redirect("/mail");
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Unable to register email address.";
			redirect(`/onboard?error=${encodeURIComponent(message)}`);
		}
	}

	return (
		<div className="flex min-h-screen items-center justify-center bg-background px-6 py-10">
			<Card className="w-full max-w-lg">
				<CardHeader>
					<CardTitle>Set up your inbox</CardTitle>
					<CardDescription>
						Register your first email address to start receiving mail.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<form action={handleSubmit} className="space-y-4">
						<div className="space-y-2">
							<label htmlFor="emailAddress" className="text-sm font-medium">
								Email address
							</label>
							<Input
								id="emailAddress"
								name="emailAddress"
								type="email"
								placeholder="you@example.com"
								required
							/>
						</div>
						<Button type="submit" className="w-full">
							Register email address
						</Button>
					</form>
					{errorMessage ? (
						<p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
							{errorMessage}
						</p>
					) : null}
				</CardContent>
			</Card>
		</div>
	);
}
