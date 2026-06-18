"use client";

import { RotateCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function RefreshButton() {
	const router = useRouter();
	return (
		<Button
			variant="ghost"
			size="icon"
			className="h-8 w-8 rounded-full"
			onClick={() => router.refresh()}
			title="Refresh"
		>
			<RotateCw className="h-4 w-4" />
			<span className="sr-only">Refresh</span>
		</Button>
	);
}
