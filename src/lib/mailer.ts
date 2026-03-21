
interface SendEmailParams {
	to: string;
	subject: string;
	text: string;
	html?: string;
	from?: { name?: string; email: string };
}

async function sendWithResend(params: SendEmailParams) {
	const { to, subject, text, html, from } = params;
	const apiKey = process.env.RESEND_API_KEY;
	if (!apiKey) throw new Error("RESEND_API_KEY is not set in environment or .env");

	const defaultFrom = from?.email || process.env.SMTP_FROM || "onboarding@resend.dev";

	const response = await fetch("https://api.resend.com/emails", {
		method: "POST",
		headers: {
			"Authorization": `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			from: from?.name ? `"${from.name}" <${defaultFrom}>` : defaultFrom,
			to: [to],
			subject,
			html: html || undefined,
			text: text || undefined,
		}),
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`Resend API Error: ${response.status} ${response.statusText} - ${errorText}`);
	}

	return await response.json();
}

async function sendWithSmtp(params: SendEmailParams) {
	const { to, subject, text, html, from } = params;

	const host = process.env.SMTP_HOST;
	const port = parseInt(process.env.SMTP_PORT || "587");
	const secure = process.env.SMTP_SECURE === "true";
	const user = process.env.SMTP_USER;
	const pass = process.env.SMTP_PASS;

	const defaultFrom = from || {
		name: "Mailer",
		email: user || "noreply@example.com",
	};

	if (process.env.NODE_ENV === "development") {
		console.log("[Mailer] Running in development mode, using nodemailer.");
		const nodemailer = await import("nodemailer");

		const transporter = nodemailer.createTransport({
			host,
			port,
			secure,
			auth: user && pass ? { user, pass } : undefined,
		});

		return await transporter.sendMail({
			from: defaultFrom.name
				? `"${defaultFrom.name}" <${defaultFrom.email}>`
				: defaultFrom.email,
			to,
			subject,
			text,
			html,
		});
	} else {
		console.log("[Mailer] Running in production/Worker mode, using worker-mailer.");
		const { WorkerMailer } = await import("worker-mailer");

		const mailer = await WorkerMailer.connect({
			credentials:
				user && pass
					? {
						username: user,
						password: pass,
					}
					: undefined,
			host: host || "",
			port,
			secure,
		});

		return await mailer.send({
			from: {
				name: defaultFrom.name,
				email: defaultFrom.email,
			},
			to: {
				email: to,
			},
			subject,
			text,
			html,
		});
	}
}

async function sendWithLocalWorker(params: SendEmailParams) {
	const { to, subject, text, html, from } = params;
	const baseUrl = process.env.LOCAL_WORKER_URL || "http://127.0.0.1:8787";
	const fromAddr = from?.email || "test@local.dev";

	const nowUtc = new Date().toISOString();
	const boundary = `----=_Part_${Date.now()}_${Math.floor(Math.random() * 10000).toString(16)}`;

	const rawEmail = `From: ${fromAddr}
To: ${to}
Subject: ${subject}
Date: ${nowUtc}
Message-ID: <test-${Date.now()}@local.dev>
MIME-Version: 1.0
Content-Type: multipart/alternative; boundary="${boundary}"

--${boundary}
Content-Type: text/plain; charset="UTF-8"

${text}

--${boundary}
Content-Type: text/html; charset="UTF-8"

${html || text}

--${boundary}--`;

	const url = `${baseUrl}/cdn-cgi/handler/email?from=${fromAddr}&to=${to}`;
	const response = await fetch(url, {
		method: "POST",
		body: rawEmail,
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`Local Worker Error: ${response.status} - ${errorText}`);
	}

	return { success: true };
}

/**
 * Sends an email using the configured provider (default: smtp).
 */
export async function sendEmail(params: SendEmailParams) {
	const provider = process.env.MAIL_PROVIDER || "smtp";

	if (provider === "resend") {
		console.log("[Mailer] Using Resend provider.");
		return await sendWithResend(params);
	} else if (provider === "local") {
		console.log("[Mailer] Using Local Worker provider.");
		return await sendWithLocalWorker(params);
	} else {
		console.log("[Mailer] Using SMTP provider.");
		return await sendWithSmtp(params);
	}
}


