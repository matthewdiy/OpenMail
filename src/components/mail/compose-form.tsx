"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import DOMPurify from "dompurify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveDraftAction, sendEmailAction } from "@/app/mail/actions";
import { Send, ArrowLeft, Trash } from "lucide-react";

interface ComposeFormProps {
	fromAddress: string;
	draft: {
		id: string;
		to: string;
		subject: string;
		text: string;
		html: string;
	} | null;
	initialCompose: {
		intent: "reply" | "forward";
		to: string;
		subject: string;
		text: string;
		html: string;
	} | null;
}

export function ComposeForm({ fromAddress, draft, initialCompose }: ComposeFormProps) {
	const router = useRouter();
	const formRef = React.useRef<HTMLFormElement>(null);
	const [loading, setLoading] = React.useState(false);
	const [savingDraft, setSavingDraft] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);
	const [info, setInfo] = React.useState<string | null>(null);
	const [currentDraftId, setCurrentDraftId] = React.useState<string | null>(draft?.id ?? null);
	const editorRef = React.useRef<HTMLDivElement>(null);
	const textInputRef = React.useRef<HTMLInputElement>(null);
	const htmlInputRef = React.useRef<HTMLInputElement>(null);
	const toDefaultValue = draft?.to ?? initialCompose?.to ?? "";
	const subjectDefaultValue = draft?.subject ?? initialCompose?.subject ?? "";
	const textDefaultValue = draft?.text ?? initialCompose?.text ?? "";
	const htmlDefaultValue = draft?.html ?? initialCompose?.html ?? "";
	const editorDefaultHtml = React.useMemo(() => {
		const fallbackHtml = textDefaultValue
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/\r?\n/g, "<br>");
		return DOMPurify.sanitize(htmlDefaultValue || fallbackHtml, {
			USE_PROFILES: { html: true },
		});
	}, [htmlDefaultValue, textDefaultValue]);
	const title = currentDraftId
		? "Edit Draft"
		: initialCompose?.intent === "reply"
			? "Reply"
			: initialCompose?.intent === "forward"
				? "Forward"
				: "New Message";

	const openComposeUrl = React.useCallback((draftId?: string | null) => {
		const params = new URLSearchParams();
		params.set("email", fromAddress);
		if (draftId) {
			params.set("draft", draftId);
		}
		return `/mail/compose?${params.toString()}`;
	}, [fromAddress]);

	const syncBodyFields = React.useCallback((normalizeEditor = false) => {
		if (!editorRef.current || !textInputRef.current || !htmlInputRef.current) {
			return { text: "", html: "" };
		}

		const html = DOMPurify.sanitize(editorRef.current.innerHTML, {
			USE_PROFILES: { html: true },
		}).trim();
		const text = editorRef.current.innerText.trim();
		if (normalizeEditor) {
			editorRef.current.innerHTML = html;
		}
		textInputRef.current.value = text;
		htmlInputRef.current.value = html;
		return { text, html };
	}, []);

	const handlePaste = React.useCallback((event: React.ClipboardEvent<HTMLDivElement>) => {
		event.preventDefault();
		const html = event.clipboardData.getData("text/html");
		const text = event.clipboardData.getData("text/plain");
		const safeHtml = html
			? DOMPurify.sanitize(html, { USE_PROFILES: { html: true } })
			: text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\r?\n/g, "<br>");
		document.execCommand("insertHTML", false, safeHtml);
	}, []);

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setLoading(true);
		setError(null);
		setInfo(null);

		const formData = new FormData(e.currentTarget);
		const to = formData.get("to") as string;
		const subject = formData.get("subject") as string;
		const { text, html } = syncBodyFields(true);

		if (!to || !subject || !text) {
			setError("Please fill in all fields.");
			setLoading(false);
			return;
		}

		try {
			await sendEmailAction({
				from: fromAddress,
				to,
				subject,
				text,
				html,
				draftId: currentDraftId ?? undefined,
			});
			router.push(`/mail?email=${encodeURIComponent(fromAddress)}`);
		} catch (err: any) {
			console.error("Failed to send email:", err);
			setError(err.message || "Something went wrong while sending.");
			setLoading(false);
		}
	};

	const handleSaveDraft = async () => {
		if (!formRef.current) return;
		setSavingDraft(true);
		setError(null);
		setInfo(null);

		const formData = new FormData(formRef.current);
		const { text, html } = syncBodyFields(true);
		try {
			const result = await saveDraftAction({
				draftId: currentDraftId ?? undefined,
				from: fromAddress,
				to: String(formData.get("to") ?? ""),
				subject: String(formData.get("subject") ?? ""),
				text,
				html,
			});
			setCurrentDraftId(result.draftId);
			setInfo("Draft saved.");
			router.replace(openComposeUrl(result.draftId));
		} catch (err: any) {
			console.error("Failed to save draft:", err);
			setError(err.message || "Unable to save draft.");
		} finally {
			setSavingDraft(false);
		}
	};

	return (
		<form ref={formRef} onSubmit={handleSubmit} className="flex h-full flex-col bg-white text-[#1f1f1f] dark:bg-[#14151a] dark:text-[#e3e3e3]">
			{/* Top Tool Bar */}
			<div className="flex h-12 items-center justify-between border-b border-gray-100 px-4 py-2 dark:border-gray-800">
				<div className="flex items-center gap-2">
					<Button 
						type="button" 
						variant="ghost" 
						size="icon" 
						className="h-8 w-8 rounded-full"
						onClick={() => router.back()}
					>
						<ArrowLeft className="h-4 w-4" />
					</Button>
					<span className="text-sm font-medium">{title}</span>
				</div>
				<div className="flex items-center gap-2">
					<Button 
						type="button" 
						variant="ghost" 
						size="icon" 
						className="h-8 w-8 rounded-full"
						onClick={() => router.push(`/mail?email=${encodeURIComponent(fromAddress)}`)}
					>
						<Trash className="h-4 w-4 text-gray-500 hover:text-red-500" />
					</Button>
				</div>
			</div>

			{/* Form Inputs */}
			<div className="flex flex-1 flex-col overflow-y-auto px-6 py-4 gap-4">
				{error && (
					<div className="p-3 bg-red-100 text-red-700 text-xs rounded-md dark:bg-red-950/30 dark:text-red-400 border border-red-200 dark:border-red-900/40">
						{error}
					</div>
				)}
				{info && (
					<div className="p-3 bg-blue-50 text-blue-700 text-xs rounded-md dark:bg-blue-950/30 dark:text-blue-300 border border-blue-200 dark:border-blue-900/40">
						{info}
					</div>
				)}

				<div className="flex gap-4">
					<div className="flex flex-col gap-1 w-1/2">
						<label className="text-xs text-muted-foreground">From</label>
						<Input 
							value={fromAddress}
							disabled 
							className="border-0 border-b border-gray-200 rounded-none px-0 py-2 focus-visible:ring-0 bg-gray-50 dark:bg-neutral-900/40 opacity-70 cursor-not-allowed dark:border-gray-800" 
						/>
					</div>

					<div className="flex flex-col gap-1 w-1/2">
						<label htmlFor="to" className="text-xs text-muted-foreground">To</label>
						<Input 
							id="to" 
							name="to" 
							placeholder="Recipient email address" 
							type="email" 
							defaultValue={toDefaultValue}
							className="border-0 border-b border-gray-200 rounded-none px-0 py-2 focus-visible:ring-0 focus-visible:border-blue-500 bg-transparent dark:border-gray-800" 
						/>
					</div>
				</div>

				<div className="flex flex-col gap-1">
					<label htmlFor="subject" className="text-xs text-muted-foreground">Subject</label>
					<Input 
						id="subject" 
						name="subject" 
						placeholder="Subject" 
						defaultValue={subjectDefaultValue}
						className="border-0 border-b border-gray-200 rounded-none px-0 py-2 focus-visible:ring-0 focus-visible:border-blue-500 bg-transparent dark:border-gray-800" 
						required 
					/>
				</div>

				<div className="flex flex-1 flex-col gap-1 mt-2">
					<input ref={textInputRef} type="hidden" name="text" defaultValue={textDefaultValue} />
					<input ref={htmlInputRef} type="hidden" name="html" defaultValue={htmlDefaultValue} />
					<div
						id="message-body"
						ref={editorRef}
						contentEditable
						role="textbox"
						aria-label="Message body"
						aria-multiline="true"
						data-placeholder="Write your email here..."
						onBlur={() => syncBodyFields(true)}
						onInput={() => syncBodyFields()}
						onPaste={handlePaste}
						className="flex-1 w-full overflow-y-auto border-0 p-0 text-sm bg-transparent focus:outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400 dark:empty:before:text-gray-500 [&_blockquote]:border-l [&_blockquote]:border-gray-300 [&_blockquote]:pl-3 [&_blockquote]:text-gray-600 dark:[&_blockquote]:border-gray-700 dark:[&_blockquote]:text-gray-300 [&_a]:text-blue-600 [&_a]:underline [&_img]:max-w-full [&_img]:h-auto"
						suppressContentEditableWarning
						dangerouslySetInnerHTML={{ __html: editorDefaultHtml }}
					/>
				</div>
			</div>

				{/* Bottom Action Bar */}
				<div className="border-t border-gray-100 p-4 flex items-center justify-between dark:border-gray-800">
					<div className="flex items-center gap-3">
						<Button
							type="button"
							variant="outline"
							disabled={savingDraft || loading}
							onClick={handleSaveDraft}
							className="rounded-full px-5"
						>
							{savingDraft ? "Saving..." : "Save draft"}
						</Button>
						<Button 
							type="submit" 
							disabled={loading}
						className="rounded-full bg-[#0b57d0] hover:bg-[#0842a0] text-white font-semibold flex items-center gap-2 px-6 dark:bg-[#a8c7fa] dark:hover:bg-[#8ab4f8] dark:text-[#041e49]"
					>
						{loading ? (
							<span className="h-4 w-4 animate-spin border-2 border-white border-t-transparent rounded-full" />
						) : (
							<Send className="h-4 w-4" />
						)}
						Send
					</Button>
				</div>
			</div>
		</form>
	);
}
