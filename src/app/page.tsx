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
		<div className="relative min-h-screen bg-background text-foreground overflow-hidden selection:bg-primary/20">
			{/* Animated Ambient Background */}
			<div className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center">
				<div className="absolute top-0 -translate-y-12 left-1/4 h-[500px] w-[500px] rounded-full bg-primary/20 blur-[100px] opacity-50 mix-blend-multiply dark:mix-blend-screen animate-in fade-in duration-1000" />
				<div className="absolute bottom-0 translate-y-1/3 right-1/4 h-[600px] w-[600px] rounded-full bg-blue-400/20 blur-[120px] opacity-40 mix-blend-multiply dark:mix-blend-screen animate-in fade-in duration-1000 delay-300" />
			</div>

			<div className="mx-auto grid min-h-screen max-w-6xl items-center gap-12 px-6 py-12 lg:grid-cols-[1.1fr_0.9fr]">
				<section className="space-y-8 animate-in slide-in-from-bottom-8 fade-in duration-700">
					<Badge variant="secondary" className="px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] bg-secondary/50 backdrop-blur-md border border-white/10 shadow-sm animate-in fade-in zoom-in duration-500 delay-150">
						OpenMail Workspace
					</Badge>
					<div className="space-y-6">
						<h1 className="text-5xl font-extrabold tracking-tight md:text-6xl lg:text-7xl bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent drop-shadow-sm leading-[1.1]">
							Open-source, AI-powered<br />email workspace.
						</h1>
						<p className="max-w-xl text-base text-muted-foreground md:text-lg leading-relaxed font-medium animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
							Bind multiple email addresses to a single user. Supercharged with AI to automatically summarize threads, classify messages, and extract verification codes.
						</p>
					</div>
					
					<div className="grid gap-5 sm:grid-cols-2 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-500">
						<Card className="sm:col-span-2 bg-background/40 backdrop-blur-xl border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] hover:scale-[1.01] transition-transform duration-300">
							<CardHeader>
								<div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
									<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
								</div>
								<CardTitle className="text-lg font-bold">Smart AI Features</CardTitle>
								<CardDescription className="text-sm font-medium">
									Automatically summarizes threads, categorizes emails, and extracts verification codes instantly.
								</CardDescription>
							</CardHeader>
						</Card>

						<Card className="bg-background/40 backdrop-blur-xl border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] hover:scale-[1.02] transition-transform duration-300">
							<CardHeader>
								<div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
									<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
								</div>
								<CardTitle className="text-lg font-bold">Multiple Addresses</CardTitle>
								<CardDescription className="text-sm font-medium">
									Seamlessly bind and manage multiple routing addresses under one user.
								</CardDescription>
							</CardHeader>
						</Card>

						<Card className="bg-background/40 backdrop-blur-xl border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] hover:scale-[1.02] transition-transform duration-300">
							<CardHeader>
								<div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
									<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/></svg>
								</div>
								<CardTitle className="text-lg font-bold">100% Open-Source</CardTitle>
								<CardDescription className="text-sm font-medium">
									Built transparently. Inspect the code, contribute, or host it yourself.
								</CardDescription>
							</CardHeader>
						</Card>
					</div>

					<div className="flex flex-wrap items-center gap-4 text-sm font-semibold text-muted-foreground animate-in fade-in duration-700 delay-700">
						<span className="flex items-center gap-1.5"><div className="h-1.5 w-1.5 rounded-full bg-emerald-500"/> Open-Source</span>
						<span className="text-border/50">•</span>
						<span className="flex items-center gap-1.5"><div className="h-1.5 w-1.5 rounded-full bg-emerald-500"/> AI-Powered</span>
						<span className="text-border/50">•</span>
						<span className="flex items-center gap-1.5"><div className="h-1.5 w-1.5 rounded-full bg-emerald-500"/> Multi-Address</span>
					</div>
				</section>

				<section className="w-full relative animate-in fade-in zoom-in-95 duration-1000 delay-300">
					<div className="absolute -inset-1 rounded-3xl bg-gradient-to-b from-primary/20 to-transparent opacity-50 blur-xl dark:from-primary/10" />
					<Card className="relative overflow-hidden border-white/20 bg-background/60 backdrop-blur-2xl shadow-2xl rounded-3xl">
						<div className="absolute inset-0 bg-gradient-to-br from-white/40 to-white/0 dark:from-white/5 dark:to-transparent pointer-events-none" />
						<CardHeader className="space-y-3 pb-8 pt-10 px-10">
							<CardTitle className="text-3xl font-bold tracking-tight">Sign in</CardTitle>
							<CardDescription className="text-base">
								Use your approved Google account to access the inbox.
							</CardDescription>
						</CardHeader>
						<CardContent className="grid gap-8 px-10 pb-10">
							<div className="relative z-10 group">
								<GoogleSignIn initialError={initialError} />
							</div>
						</CardContent>
					</Card>
				</section>
			</div>
		</div>
	);
}
