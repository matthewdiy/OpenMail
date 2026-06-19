#! /usr/bin/env bun
/**
 * Test email sender inside a TypeScript script setups.
 * Usage: pnpm dlx tsx scripts/send-test-email.ts [TO] [FROM] [BASE_URL]
 */

const from = process.argv[2] || "sender@local.dev";
const to = process.argv[3] || "test@local.dev";
const baseUrl = process.argv[4] || "http://127.0.0.1:8787";

const nowUtc = new Date().toISOString();
const subject = `Test email ${nowUtc}`;
const boundary = `----=_Part_${Date.now()}_${Math.floor(Math.random() * 10000).toString(16)}`;

const rawEmail = `From: ${from}
To: ${to}
Subject: ${subject}
Date: ${nowUtc}
Message-ID: <test-${nowUtc}@local.dev>
MIME-Version: 1.0
Content-Type: multipart/alternative; boundary="${boundary}"

--${boundary}
Content-Type: text/plain; charset="UTF-8"

Hello A sign in attempt requires further verification because we did not recognize your device. To complete the sign in, enter the verification code on the unrecognized device.
Device: Chrome on Windows. Verification code: 161304
Sent at (UTC): ${nowUtc}

--${boundary}
Content-Type: text/html; charset="UTF-8"

<div style="font-family: ui-sans-serif, system-ui; font-size: 14px;">
  <strong>Hello</strong> A sign in attempt requires further verification because we did not recognize your device. To complete the sign in, enter the verification code on the unrecognized device.<br/>
Device: Chrome on Windows<br/>
Verification code: 161304
<br />
  <span>Sent at (UTC): ${nowUtc}</span>
</div>

--${boundary}--`;

async function main() {
	const url = `${baseUrl}/cdn-cgi/handler/email?from=${from}&to=${to}`;
	try {
		const response = await fetch(url, {
			method: "POST",
			body: rawEmail,
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Failed to send: ${response.status} ${response.statusText} - ${errorText}`);
		}

		console.log(`Sent test email to ${to} from ${from} via ${baseUrl} at ${nowUtc}`);
	} catch (e) {
		console.error("Error sending email:", e);
	}
}

main();
