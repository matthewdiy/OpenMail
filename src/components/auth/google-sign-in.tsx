"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { Loader2, AlertCircle } from "lucide-react";
import { CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type GoogleSignInProps = {
	initialError?: string | null;
	showHeader?: boolean;
};

export function GoogleSignIn({ initialError, showHeader = false }: GoogleSignInProps) {
	const [error, setError] = useState(initialError ?? "");
	const [isLoading, setIsLoading] = useState(false);
	const router = useRouter();

	const handleSignIn = async () => {
		setError("");
		setIsLoading(true);
		try {
			const { error: signInError } = await authClient.signIn.social({
				provider: "google",
				callbackURL: "/mail",
			});
			if (signInError?.message) {
				setError(signInError.message);
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Unable to start sign-in.");
		} finally {
			setIsLoading(false);
			router.refresh();
		}
	};

	return (
		<>
			{showHeader && (
				<CardHeader className="space-y-3 pb-8 pt-10 px-10">
					<CardTitle className="text-3xl font-bold tracking-tight">Sign in</CardTitle>
					<CardDescription className="text-base">
						Use your approved Google account to access the inbox.
					</CardDescription>
				</CardHeader>
			)}
			<div className={cn("grid gap-4", showHeader && "px-10 pb-10")}>
				<Button
					type="button"
					variant="outline"
					onClick={handleSignIn}
					disabled={isLoading}
					className="w-full h-11 rounded-xl border-input bg-background/50 hover:bg-accent/50 text-foreground font-medium transition-all shadow-sm flex items-center justify-center hover:scale-[1.01] active:scale-[0.99] duration-200"
				>
					{isLoading ? (
						<>
							<Loader2 className="mr-2 h-4 w-4 animate-spin text-muted-foreground" />
							Connecting to Google...
						</>
					) : (
						<>
							<svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
								<path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
								<path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
								<path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z" fill="#FBBC05" />
								<path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
							</svg>
							Continue with Google
						</>
					)}
				</Button>
				{error ? (
					<div className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive animate-in fade-in slide-in-from-top-2 duration-200">
						<AlertCircle className="h-4 w-4 shrink-0" />
						<p>{error}</p>
					</div>
				) : null}
			</div>
		</>
	);
}

