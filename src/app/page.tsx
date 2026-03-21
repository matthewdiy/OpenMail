import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { GoogleSignIn } from "@/components/auth/google-sign-in";
import { getAuth } from "@/lib/auth";

type HomePageProps = {
	searchParams: Promise<{
		error?: string | string[];
		message?: string | string[];
		auth_error?: string | string[];
	}>;
};

function getParamValue(value?: string | string[]) {
	if (!value) return undefined;
	return Array.isArray(value) ? value[0] : value;
}

export default async function Home({ searchParams }: HomePageProps) {
	const resolvedSearchParams = await searchParams;
	const reqHeaders = await headers();
	const session = await getAuth().api.getSession({ headers: reqHeaders });
	if (session) {
		redirect("/mail");
	}

	const errorParam =
		getParamValue(resolvedSearchParams?.auth_error) ??
		getParamValue(resolvedSearchParams?.message) ??
		getParamValue(resolvedSearchParams?.error);
	const initialError = errorParam
		? "Sign-in failed. Please try again."
		: null;

	return (
		<div className="relative min-h-screen bg-background text-foreground">
			<div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(55%_45%_at_0%_0%,rgba(124,123,255,0.28),transparent_70%),radial-gradient(40%_40%_at_100%_0%,rgba(14,165,233,0.2),transparent_70%)]" />
			<div className="mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-6 py-12 lg:grid-cols-[1.1fr_0.9fr]">
				<section className="space-y-6">
					<Badge variant="secondary" className="uppercase tracking-[0.4em]">
						OpenMail
					</Badge>
					<div className="space-y-4">
						<h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
							Control every routed message from a single secure inbox.
						</h1>
						<p className="max-w-xl text-sm text-muted-foreground md:text-base">
							A focused workspace for inspecting inbound mail, validating routing, and
							troubleshooting delivery across your Cloudflare setup.
						</p>
					</div>
					<div className="grid gap-4 sm:grid-cols-2">
						<Card className="bg-card/80">
							<CardHeader>
								<CardTitle className="text-base">Raw + parsed previews</CardTitle>
								<CardDescription>
									Quickly validate headers, body, and payload sizes.
								</CardDescription>
							</CardHeader>
						</Card>
						<Card className="bg-card/80">
							<CardHeader>
								<CardTitle className="text-base">Route monitoring</CardTitle>
								<CardDescription>
									Spot new traffic, filter by sender, and export evidence.
								</CardDescription>
							</CardHeader>
						</Card>
					</div>
					<div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
						<span>Auditable</span>
						<span className="text-border">•</span>
						<span>Invite-only access</span>
						<span className="text-border">•</span>
						<span>Built on Cloudflare D1 + R2</span>
					</div>
				</section>

				<section className="w-full">
					<Card className="border-border/60 bg-card/90 shadow-lg">
						<CardHeader className="space-y-2">
							<CardTitle className="text-2xl">Sign in</CardTitle>
							<CardDescription>
								Use your approved Google account to access the inbox.
							</CardDescription>
						</CardHeader>
						<CardContent className="grid gap-6">
							<GoogleSignIn initialError={initialError} />
							<Separator className="bg-border/60" />
							<div className="space-y-2 text-xs text-muted-foreground">
								<p>Admin role is assigned automatically when your email matches ADMIN_EMAIL.</p>
								<Button variant="outline" className="w-full" type="button">
									Request access
								</Button>
							</div>
						</CardContent>
					</Card>
				</section>
			</div>
		</div>
	);
}
