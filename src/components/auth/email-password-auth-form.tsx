"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GoogleSignIn } from "@/components/auth/google-sign-in";
import { authClient } from "@/lib/auth-client";
import { CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
	Mail,
	Lock,
	User,
	Eye,
	EyeOff,
	Loader2,
	AlertCircle,
	CheckCircle2,
	ArrowRight
} from "lucide-react";

type AuthMode = "sign-in" | "sign-up";

type EmailPasswordAuthFormProps = {
	initialError?: string | null;
	requireEmailVerification?: boolean;
	oauthProviders?: ("google" | "github")[];
};

function getAuthErrorMessage(error: unknown) {
	if (error instanceof Error) return error.message;
	return "Unable to complete authentication.";
}

function isEmailNotVerifiedMessage(message: string) {
	const normalized = message.toLowerCase();
	return normalized.includes("email not verified") || normalized.includes("not verified");
}

export function EmailPasswordAuthForm({
	initialError,
	requireEmailVerification = false,
	oauthProviders = ["google"],
}: EmailPasswordAuthFormProps) {
	const [mode, setMode] = useState<AuthMode>("sign-in");
	const [error, setError] = useState(initialError ?? "");
	const [success, setSuccess] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [showPassword, setShowPassword] = useState(false);
	const [passwordValue, setPasswordValue] = useState("");
	const router = useRouter();

	const isSignUp = mode === "sign-up";

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setError("");
		setSuccess("");

		const form = event.currentTarget;
		const formData = new FormData(form);
		const email = String(formData.get("email") ?? "").trim();
		const password = String(formData.get("password") ?? "");
		const name = String(formData.get("name") ?? "").trim();

		if (!email || !password || (isSignUp && !name)) {
			setError("Please fill in all required fields.");
			return;
		}
		if (password.length < 8) {
			setError("Password must be at least 8 characters.");
			return;
		}

		setIsLoading(true);
		try {
			const callbackURL = `${window.location.origin}/mail`;
			const response = isSignUp
				? await authClient.signUp.email({
					name,
					email,
					password,
					callbackURL,
				})
				: await authClient.signIn.email({
					email,
					password,
					callbackURL,
				});

			if (response.error?.message) {
				setError(
					isEmailNotVerifiedMessage(response.error.message)
						? "Please verify your email before signing in. We sent a fresh verification link to your inbox."
						: response.error.message
				);
				return;
			}

			if (isSignUp && requireEmailVerification) {
				setMode("sign-in");
				setSuccess("Check your inbox for a verification link before signing in.");
				setPasswordValue("");
				form.reset();
				return;
			}

			router.push("/mail");
			router.refresh();
		} catch (err) {
			setError(getAuthErrorMessage(err));
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<>
			<CardHeader className="space-y-3 pb-8 pt-10 px-10">
				<CardTitle className="text-3xl font-bold tracking-tight">
					{isSignUp ? "Create an account" : "Sign in"}
				</CardTitle>
				<CardDescription className="text-base">
					{isSignUp
						? "Enter your details below to set up your inbox workspace."
						: "Use your email and password or continue with social providers."}
				</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-8 px-10 pb-10">
				<div className="grid gap-6">
					{/* Sliding Tab Switcher */}
					<div className="relative flex rounded-xl bg-muted/40 p-1 border border-border/50">
						<div
							className={cn(
								"absolute bottom-1 top-1 w-[calc(50%-4px)] rounded-lg bg-background shadow-sm transition-all duration-300 ease-in-out",
								mode === "sign-in" ? "left-1" : "left-1 translate-x-full"
							)}
						/>
						<button
							type="button"
							onClick={() => {
								setMode("sign-in");
								setError("");
								setSuccess("");
							}}
							disabled={isLoading}
							className={cn(
								"relative z-10 flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-200 text-center focus:outline-none cursor-pointer",
								mode === "sign-in" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
							)}
						>
							Sign in
						</button>
						<button
							type="button"
							onClick={() => {
								setMode("sign-up");
								setError("");
								setSuccess("");
							}}
							disabled={isLoading}
							className={cn(
								"relative z-10 flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-200 text-center focus:outline-none cursor-pointer",
								mode === "sign-up" ? "text-foreground" : "text-muted-foreground hover:text-foreground"
							)}
						>
							Sign up
						</button>
					</div>

					<form onSubmit={handleSubmit} className="grid gap-5">
						{isSignUp ? (
							<div className="grid gap-2 animate-in fade-in slide-in-from-top-3 duration-300">
								<label htmlFor="name" className="text-sm font-medium text-foreground/80">
									Name
								</label>
								<div className="relative group">
									<div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors duration-200">
										<User className="h-4 w-4" />
									</div>
									<Input
										id="name"
										name="name"
										autoComplete="name"
										placeholder="Ada Lovelace"
										disabled={isLoading}
										required={isSignUp}
										className="pl-10 h-11 bg-background/50 backdrop-blur-sm focus-visible:ring-primary/50 transition-all"
									/>
								</div>
							</div>
						) : null}

						<div className="grid gap-2">
							<label htmlFor="email" className="text-sm font-medium text-foreground/80">
								Email
							</label>
							<div className="relative group">
								<div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors duration-200">
									<Mail className="h-4 w-4" />
								</div>
								<Input
									id="email"
									name="email"
									type="email"
									autoComplete="email"
									placeholder="you@example.com"
									disabled={isLoading}
									required
									className="pl-10 h-11 bg-background/50 backdrop-blur-sm focus-visible:ring-primary/50 transition-all"
								/>
							</div>
						</div>

						<div className="grid gap-2">
							<label htmlFor="password" className="text-sm font-medium text-foreground/80">
								Password
							</label>
							<div className="relative group">
								<div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors duration-200">
									<Lock className="h-4 w-4" />
								</div>
								<Input
									id="password"
									name="password"
									type={showPassword ? "text" : "password"}
									autoComplete={isSignUp ? "new-password" : "current-password"}
									minLength={8}
									placeholder="At least 8 characters"
									value={passwordValue}
									onChange={(e) => setPasswordValue(e.target.value)}
									disabled={isLoading}
									required
									className="pl-10 pr-10 h-11 bg-background/50 backdrop-blur-sm focus-visible:ring-primary/50 transition-all"
								/>
								<button
									type="button"
									onClick={() => setShowPassword(!showPassword)}
									disabled={isLoading}
									className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors duration-200 focus:outline-none cursor-pointer"
									tabIndex={-1}
								>
									{showPassword ? (
										<EyeOff className="h-4 w-4" />
									) : (
										<Eye className="h-4 w-4" />
									)}
								</button>
							</div>
						</div>

						{isSignUp && passwordValue.length > 0 && (
							<div className="flex items-center gap-2 text-xs transition-all animate-in fade-in duration-200">
								{passwordValue.length >= 8 ? (
									<CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 fill-emerald-500/10" />
								) : (
									<div className="h-3.5 w-3.5 rounded-full border border-muted-foreground/30 flex items-center justify-center text-[10px] text-muted-foreground/50 font-bold">!</div>
								)}
								<span className={cn(
									"font-medium",
									passwordValue.length >= 8 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
								)}>
									Password must be at least 8 characters
								</span>
							</div>
						)}

						<Button type="submit" disabled={isLoading} className="w-full h-11 text-sm font-semibold shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 group/btn cursor-pointer">
							{isLoading ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									{isSignUp ? "Creating account..." : "Signing in..."}
								</>
							) : (
								<>
									{isSignUp ? "Create account" : "Sign in with email"}
									<ArrowRight className="ml-2 h-4 w-4 transition-transform duration-200 group-hover/btn:translate-x-1" />
								</>
							)}
						</Button>
					</form>

					{error ? (
						<div className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive animate-in fade-in slide-in-from-top-2 duration-200">
							<AlertCircle className="h-4 w-4 shrink-0" />
							<p>{error}</p>
						</div>
					) : null}
					{success ? (
						<div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-600 dark:text-emerald-400 animate-in fade-in slide-in-from-top-2 duration-200">
							<CheckCircle2 className="h-4 w-4 shrink-0" />
							<p>{success}</p>
						</div>
					) : null}

					{oauthProviders.length > 0 ? (
						<>
							<div className="relative flex items-center my-1">
								<div className="flex-grow border-t border-border/80" />
								<span className="flex-shrink mx-4 text-xs font-semibold uppercase text-muted-foreground tracking-wider">
									or
								</span>
								<div className="flex-grow border-t border-border/80" />
							</div>

							<GoogleSignIn providers={oauthProviders} />
						</>
					) : null}
				</div>
			</CardContent>
		</>
	);
}
