"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

type GoogleSignInProps = {
	initialError?: string | null;
};

export function GoogleSignIn({ initialError }: GoogleSignInProps) {
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
		<div className="grid gap-4">
			<Button onClick={handleSignIn} disabled={isLoading} className="w-full">
				{isLoading ? "Redirecting..." : "Continue with Google"}
			</Button>
			{error ? (
				<p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
					{error}
				</p>
			) : null}
		</div>
	);
}
