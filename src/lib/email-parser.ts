import PostalMime from "postal-mime";

export type ParsedEmailContent = {
	from?: string;
	to?: string;
	subject?: string;
	text?: string;
	html?: string;
};

function firstParsedAddressToString(
	address: Awaited<ReturnType<PostalMime["parse"]>>["from"] | Awaited<ReturnType<PostalMime["parse"]>>["to"]
) {
	if (!address) {
		return undefined;
	}

	if (Array.isArray(address)) {
		const first = address[0];
		if (!first) {
			return undefined;
		}
		if ("address" in first && first.address) {
			return first.address;
		}
		if ("group" in first && first.group?.[0]?.address) {
			return first.group[0].address;
		}
		return undefined;
	}

	if ("address" in address && address.address) {
		return address.address;
	}
	if ("group" in address && address.group?.[0]?.address) {
		return address.group[0].address;
	}
	return undefined;
}

export async function parseRawEmailBuffer(rawBuffer: ArrayBuffer): Promise<ParsedEmailContent> {
	const parser = new PostalMime();
	const parsed = await parser.parse(new Uint8Array(rawBuffer));

	return {
		from: firstParsedAddressToString(parsed.from),
		to: firstParsedAddressToString(parsed.to),
		subject: parsed.subject,
		text: parsed.text,
		html: parsed.html,
	};
}

export function stripHtml(html: string) {
	return htmlToText(html);
}

function decodeHtmlEntities(value: string) {
	const namedEntities: Record<string, string> = {
		amp: "&",
		apos: "'",
		gt: ">",
		lt: "<",
		nbsp: " ",
		quot: "\"",
	};

	return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
		const normalized = entity.toLowerCase();
		if (normalized.startsWith("#x")) {
			const codePoint = Number.parseInt(normalized.slice(2), 16);
			return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
		}
		if (normalized.startsWith("#")) {
			const codePoint = Number.parseInt(normalized.slice(1), 10);
			return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
		}
		return namedEntities[normalized] ?? match;
	});
}

export function htmlToText(html: string) {
	return decodeHtmlEntities(
		html
			.replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, " ")
			.replace(/<\s*br\s*\/?>/gi, "\n")
			.replace(/<\s*\/\s*(p|div|section|article|header|footer|blockquote|tr|table|ul|ol|li|h[1-6])\s*>/gi, "\n")
			.replace(/<\s*li[^>]*>/gi, "\n- ")
			.replace(/<[^>]*>?/g, " ")
	)
		.replace(/[ \t]+\n/g, "\n")
		.replace(/\n[ \t]+/g, "\n")
		.replace(/[ \t]{2,}/g, " ")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}
