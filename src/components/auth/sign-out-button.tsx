"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

type SignOutButtonProps = {
	variant?: "default" | "secondary" | "outline";
};

export function SignOutButton({ variant = "outline" }: SignOutButtonProps) {
	const router = useRouter();

	const handleSignOut = async () => {
		await authClient.signOut();
		router.push("/");
		router.refresh();
	};

	return (
		<Button type="button" variant={variant} onClick={handleSignOut}>
			Sign out
		</Button>
	);
}
