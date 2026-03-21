import PostalMime from "postal-mime";

export type ParsedEmailContent = {
	text?: string;
	html?: string;
};

export async function parseRawEmailBuffer(rawBuffer: ArrayBuffer): Promise<ParsedEmailContent> {
	const parser = new PostalMime();
	const parsed = await parser.parse(new Uint8Array(rawBuffer));

	return {
		text: parsed.text,
		html: parsed.html,
	};
}

export function stripHtml(html: string) {
	return html.replace(/<[^>]*>?/gm, " ").replace(/\s+/g, " ").trim();
}
