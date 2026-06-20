import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ComposeForm } from "@/components/mail/compose-form";
import {
	getDraftByIdForAddress,
	getEmailByIdForAddress,
	getEmailObject,
	resolveActiveEmailAddress,
} from "@/lib/mail-store";
import { htmlToText, parseRawEmailBuffer } from "@/lib/email-parser";

export const revalidate = 0;

type ComposeMode = "reply" | "forward";

type InitialComposePayload = {
	intent: ComposeMode;
	to: string;
	subject: string;
	text: string;
	html: string;
};

type SourceBody = {
	text: string;
	html: string;
};

function normalizeComposeMode(value?: string): ComposeMode | null {
	if (value === "reply" || value === "forward") {
		return value;
	}
	return null;
}

function extractBody(rawText: string) {
	const parts = rawText.split(/\r?\n\r?\n/);
	if (parts.length <= 1) return rawText;
	return parts.slice(1).join("\n\n").trim();
}

function formatTimestamp(value: string) {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;
	return date.toUTCString();
}

function quotePlainText(text: string) {
	return text
		.split(/\r?\n/)
		.map((line) => `> ${line}`)
		.join("\n");
}

function escapeHtml(value: string) {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function plainTextToHtml(text: string) {
	return escapeHtml(text).replace(/\r?\n/g, "<br>");
}

function withPrefix(subject: string | null | undefined, mode: ComposeMode) {
	const base = subject?.trim() || "(no subject)";
	if (mode === "reply") {
		return /^re:/i.test(base) ? base : `Re: ${base}`;
	}
	return /^(fwd|fw):/i.test(base) ? base : `Fwd: ${base}`;
}

async function getSourceBody(r2Key: string | null | undefined, snippet: string | null | undefined): Promise<SourceBody> {
	const fallbackText = snippet?.trim() || "";
	if (!r2Key) {
		return {
			text: fallbackText,
			html: fallbackText ? plainTextToHtml(fallbackText) : "",
		};
	}

	try {
		const r2Object = await getEmailObject(r2Key);
		if (!r2Object) {
			return {
				text: fallbackText,
				html: fallbackText ? plainTextToHtml(fallbackText) : "",
			};
		}

		const rawBuffer = await r2Object.arrayBuffer();
		const parsed = await parseRawEmailBuffer(rawBuffer);
		const html = parsed.html?.trim() || "";
		const text = parsed.text?.trim() || (html ? htmlToText(html) : "").trim();
		if (text || html) {
			return {
				text,
				html: html || plainTextToHtml(text),
			};
		}

		const rawPreview = new TextDecoder().decode(rawBuffer.slice(0, 50_000));
		const rawText = extractBody(rawPreview).trim() || fallbackText;
		return {
			text: rawText,
			html: rawText ? plainTextToHtml(rawText) : "",
		};
	} catch (error) {
		console.error("Failed to parse source email for compose prefill:", error);
		return {
			text: fallbackText,
			html: fallbackText ? plainTextToHtml(fallbackText) : "",
		};
	}
}

async function buildInitialComposeFromSource(
	mode: ComposeMode,
	sourceId: string,
	activeEmail: string
): Promise<InitialComposePayload | null> {
	const source = await getEmailByIdForAddress(sourceId, activeEmail);
	if (!source) {
		return null;
	}

	const sourceBody = await getSourceBody(source.r2_key, source.snippet);
	const sourceText = sourceBody.text || (sourceBody.html ? htmlToText(sourceBody.html) : "");
	const sourceHtml = sourceBody.html || (sourceText ? plainTextToHtml(sourceText) : "");
	const quotedSource = sourceText ? quotePlainText(sourceText) : "> ";
	const subject = withPrefix(source.subject, mode);
	const replyIntroText = `On ${formatTimestamp(source.received_at)}, ${source.from_addr} wrote:`;
	const replyIntroHtml = escapeHtml(replyIntroText);
	const forwardedMetadataHtml = [
		"<div>---------- Forwarded message ----------</div>",
		`<div><strong>From:</strong> ${escapeHtml(source.from_addr)}</div>`,
		`<div><strong>Date:</strong> ${escapeHtml(formatTimestamp(source.received_at))}</div>`,
		`<div><strong>Subject:</strong> ${escapeHtml(source.subject || "(no subject)")}</div>`,
		`<div><strong>To:</strong> ${escapeHtml(source.to_addr)}</div>`,
	].join("");

	if (mode === "reply") {
		return {
			intent: "reply",
			to: source.from_addr,
			subject,
			text: `\n\n${replyIntroText}\n${quotedSource}`,
			html: `<div><br></div><div><br></div><div>${replyIntroHtml}</div><blockquote style="margin:0 0 0 0.8ex;border-left:1px solid #ccc;padding-left:1ex;">${sourceHtml}</blockquote>`,
		};
	}

	return {
		intent: "forward",
		to: "",
		subject,
		text: `\n\n---------- Forwarded message ----------\nFrom: ${source.from_addr}\nDate: ${formatTimestamp(source.received_at)}\nSubject: ${source.subject || "(no subject)"}\nTo: ${source.to_addr}\n\n${quotedSource}`,
		html: `<div><br></div><div><br></div>${forwardedMetadataHtml}<div><br></div>${sourceHtml}`,
	};
}

export default async function ComposePage({
	searchParams,
}: {
	searchParams: Promise<{ email?: string; draft?: string; mode?: string; sourceId?: string }>;
}) {
	const resolvedSearchParams = await searchParams;
	const reqHeaders = await headers();
	const session = await getAuth().api.getSession({ headers: reqHeaders });
	if (!session) redirect("/");

	const { activeEmail, needsRedirect } = await resolveActiveEmailAddress(
		session.user.id,
		resolvedSearchParams.email
	);
	if (!activeEmail) {
		redirect("/onboard");
	}
	if (needsRedirect) {
		const params = new URLSearchParams();
		params.set("email", activeEmail);
		if (resolvedSearchParams.draft) {
			params.set("draft", resolvedSearchParams.draft);
		}
		if (resolvedSearchParams.mode) {
			params.set("mode", resolvedSearchParams.mode);
		}
		if (resolvedSearchParams.sourceId) {
			params.set("sourceId", resolvedSearchParams.sourceId);
		}
		redirect(`/mail/compose?${params.toString()}`);
	}

	const mode = normalizeComposeMode(resolvedSearchParams.mode);
	const sourceId = resolvedSearchParams.sourceId?.trim();
	const draftId = resolvedSearchParams.draft?.trim();
	const draft = draftId
		? await getDraftByIdForAddress(draftId, session.user.id, activeEmail)
		: null;
	if (draftId && !draft) {
		const params = new URLSearchParams();
		params.set("email", activeEmail);
		if (mode && sourceId) {
			params.set("mode", mode);
			params.set("sourceId", sourceId);
		}
		redirect(`/mail/compose?${params.toString()}`);
	}

	const initialCompose = !draft && mode && sourceId
		? await buildInitialComposeFromSource(mode, sourceId, activeEmail)
		: null;
	const composeKey = draft?.id ?? (initialCompose ? `${initialCompose.intent}:${sourceId}` : "new");

	return (
		<ComposeForm
			key={composeKey}
			fromAddress={activeEmail}
			draft={draft ? {
				id: draft.id,
				to: draft.to_addr ?? "",
				subject: draft.subject ?? "",
				text: draft.text ?? "",
				html: draft.html ?? "",
			} : null}
			initialCompose={initialCompose}
		/>
	);
}
