"use client";
import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function VerificationBadge({ code }: { code: string }) {
	const [copied, setCopied] = useState(false);

	const handleCopy = async (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		await navigator.clipboard.writeText(code);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	return (
		<span
			onClick={handleCopy}
			className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-xs hover:scale-105 font-semibold text-amber-700 dark:bg-amber-950/20 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/40 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-950/30 transition-colors relative group"
		>
			<span className="truncate max-w-[120px]">
				{copied ? "Copied!" : `Code: ${code}`}
			</span>
			{copied ? (
				<Check className="h-3 w-3 text-green-600 dark:text-green-500" />
			) : (
				<Copy className="h-3 w-3 opacity-60 group-hover:opacity-100 transition-opacity" />
			)}
		</span>
	);
}
