"use client";

import { useMemo } from "react";
import DOMPurify from "dompurify";

type SanitizedEmailContentProps = {
	html?: string;
	text?: string;
};

export function SanitizedEmailContent({ html, text }: SanitizedEmailContentProps) {
	const sanitizedHtml = useMemo(() => {
		if (!html) return "";
		return DOMPurify.sanitize(html, {
			USE_PROFILES: { html: true },
		});
	}, [html]);

	if (sanitizedHtml) {
		return (
			<div
				className="text-sm text-gray-700 dark:text-gray-300 [&_a]:text-blue-600 [&_a]:underline [&_img]:max-w-full [&_img]:h-auto"
				dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
			/>
		);
	}

	return (
		<p className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
			{text || "No body content extracted."}
		</p>
	);
}
