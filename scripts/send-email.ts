#!/usr/bin/env bun
import { sendEmail } from "../src/lib/mailer";
import "dotenv/config";

async function main() {
	const from = process.argv[2];
	const to = process.argv[3];
	const subject = process.argv[4] || 'Hello World';
	const html = process.argv[5] || 'Hello World <strong>It works!</strong>';

	if (!from || !to) {
		console.error("❌ Missing required arguments: from and to");
		console.log("Usage: bun scripts/send-email.ts [FROM] [TO] [SUBJECT] [BODY]");
		process.exit(1);
	}

	console.log(`Sending email from ${from} to ${to} using app mailer...`);

	try {
		await sendEmail({
			from: { email: from },
			to,
			subject,
			text: html.replace(/<[^>]*>?/gm, ""), // simplistic text fallback
			html,
		});
		console.log("✅ Message sent successfully!");
	} catch (error) {
		console.error("❌ Failed to send email:", error);
	}
}

main().catch(console.error);

