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
import { parseRawEmailBuffer, stripHtml } from "@/lib/email-parser";

export const revalidate = 0;

type ComposeMode = "reply" | "forward";

type InitialComposePayload = {
	intent: ComposeMode;
	to: string;
	subject: string;
	text: string;
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

function withPrefix(subject: string | null | undefined, mode: ComposeMode) {
	const base = subject?.trim() || "(no subject)";
	if (mode === "reply") {
		return /^re:/i.test(base) ? base : `Re: ${base}`;
	}
	return /^(fwd|fw):/i.test(base) ? base : `Fwd: ${base}`;
}

async function getSourceBodyText(r2Key: string | null | undefined, snippet: string | null | undefined) {
	if (!r2Key) {
		return snippet?.trim() || "";
	}

	try {
		const r2Object = await getEmailObject(r2Key);
		if (!r2Object) {
			return snippet?.trim() || "";
		}

		const rawBuffer = await r2Object.arrayBuffer();
		const parsed = await parseRawEmailBuffer(rawBuffer);
		const parsedText = parsed.text?.trim() || (parsed.html ? stripHtml(parsed.html) : "").trim();
		if (parsedText) {
			return parsedText;
		}

		const rawPreview = new TextDecoder().decode(rawBuffer.slice(0, 50_000));
		return extractBody(rawPreview).trim() || snippet?.trim() || "";
	} catch (error) {
		console.error("Failed to parse source email for compose prefill:", error);
		return snippet?.trim() || "";
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

	const sourceText = await getSourceBodyText(source.r2_key, source.snippet);
	const quotedSource = sourceText ? quotePlainText(sourceText) : "> ";
	const subject = withPrefix(source.subject, mode);

	if (mode === "reply") {
		return {
			intent: "reply",
			to: source.from_addr,
			subject,
			text: `\n\nOn ${formatTimestamp(source.received_at)}, ${source.from_addr} wrote:\n${quotedSource}`,
		};
	}

	return {
		intent: "forward",
		to: "",
		subject,
		text: `\n\n---------- Forwarded message ----------\nFrom: ${source.from_addr}\nDate: ${formatTimestamp(source.received_at)}\nSubject: ${source.subject || "(no subject)"}\nTo: ${source.to_addr}\n\n${quotedSource}`,
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
			} : null}
			initialCompose={initialCompose}
		/>
	);
}
