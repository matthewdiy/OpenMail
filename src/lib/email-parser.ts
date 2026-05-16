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
	return html.replace(/<[^>]*>?/gm, " ").replace(/\s+/g, " ").trim();
}
