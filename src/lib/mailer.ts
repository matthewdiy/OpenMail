import {
	bootstrapSystemConfigFromEnvIfMissing,
	buildSystemConfigV1FromEnv,
	type MailProvider,
	type SystemConfigV1,
} from "@/lib/system-config";

interface SendEmailParams {
	to: string;
	subject: string;
	text: string;
	html?: string;
	from?: { name?: string; email: string };
}

interface MailRuntimeConfig {
	provider: MailProvider;
	smtp: SystemConfigV1["mail"]["smtp"];
	resend: SystemConfigV1["mail"]["resend"];
	local: SystemConfigV1["mail"]["local"];
}

async function sendWithResend(params: SendEmailParams, config: SystemConfigV1["mail"]["resend"]) {
	const { to, subject, text, html, from } = params;
	const apiKey = config.apiKey;
	if (!apiKey) {
		throw new Error("Resend API key is missing in system config / env fallback.");
	}

	const defaultFrom = from?.email || process.env.SMTP_FROM || "onboarding@resend.dev";

	const response = await fetch("https://api.resend.com/emails", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
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

async function sendWithSmtp(params: SendEmailParams, config: SystemConfigV1["mail"]["smtp"]) {
	const { to, subject, text, html, from } = params;

	const defaultFrom = from || {
		name: "Mailer",
		email: config.user || "noreply@example.com",
	};

	if (process.env.NODE_ENV === "development") {
		console.log("[Mailer] Running in development mode, using nodemailer.");
		const nodemailer = await import("nodemailer");

		const transporter = nodemailer.createTransport({
			host: config.host,
			port: config.port,
			secure: config.secure,
			auth: config.user && config.pass ? { user: config.user, pass: config.pass } : undefined,
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
				config.user && config.pass
					? {
						username: config.user,
						password: config.pass,
					}
					: undefined,
			host: config.host,
			port: config.port,
			secure: config.secure,
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

async function sendWithLocalWorker(params: SendEmailParams, config: SystemConfigV1["mail"]["local"]) {
	const { to, subject, text, html, from } = params;
	const baseUrl = config.baseUrl || "http://127.0.0.1:8787";
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

async function resolveMailRuntimeConfig(): Promise<MailRuntimeConfig> {
	const systemConfig =
		(await bootstrapSystemConfigFromEnvIfMissing()) ??
		buildSystemConfigV1FromEnv();
	const isDevMode = process.env.NODE_ENV === "development";
	const provider =
		!isDevMode && systemConfig.mail.provider === "local"
			? "smtp"
			: systemConfig.mail.provider;

	return {
		provider,
		smtp: systemConfig.mail.smtp,
		resend: systemConfig.mail.resend,
		local: systemConfig.mail.local,
	};
}

/**
 * Sends an email using the configured provider.
 * Resolution order: D1 system config (bootstrapped from env if missing) -> env fallback.
 */
export async function sendEmail(params: SendEmailParams) {
	const config = await resolveMailRuntimeConfig();

	if (config.provider === "resend") {
		console.log("[Mailer] Using Resend provider.");
		return await sendWithResend(params, config.resend);
	}
	if (config.provider === "local") {
		console.log("[Mailer] Using Local Worker provider.");
		return await sendWithLocalWorker(params, config.local);
	}

	console.log("[Mailer] Using SMTP provider.");
	return await sendWithSmtp(params, config.smtp);
}
