"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { MailProvider, SystemConfigV1 } from "@/lib/system-config";

interface MailProviderConfigFormProps {
	initialConfig: SystemConfigV1;
	saveAction: (formData: FormData) => Promise<void>;
	sourceLabel: string;
	allowLocalProvider: boolean;
}

export function MailProviderConfigForm({
	initialConfig,
	saveAction,
	sourceLabel,
	allowLocalProvider,
}: MailProviderConfigFormProps) {
	const initialProvider: MailProvider =
		!allowLocalProvider && initialConfig.mail.provider === "local"
			? "smtp"
			: initialConfig.mail.provider;
	const [provider, setProvider] = useState<MailProvider>(initialProvider);
	const [smtpSecure, setSmtpSecure] = useState(initialConfig.mail.smtp.secure ? "true" : "false");

	return (
		<div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
			<div className="mb-4 space-y-1">
				<h2 className="text-lg font-medium">Mail Provider Configuration</h2>
				<p className="text-sm text-muted-foreground">
					System config source: <span className="font-medium">{sourceLabel}</span>
				</p>
				<p className="text-xs text-muted-foreground">
					Credentials are stored in D1 plain text for this iteration.
				</p>
			</div>

			<form action={saveAction} className="flex flex-col gap-4">
				<div className="flex flex-col gap-2 max-w-sm">
					<label className="text-sm font-medium">Provider</label>
					<Select value={provider} onValueChange={(value) => setProvider(value as MailProvider)}>
						<SelectTrigger>
							<SelectValue placeholder="Select provider" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="smtp">smtp</SelectItem>
							<SelectItem value="resend">resend</SelectItem>
							{allowLocalProvider ? <SelectItem value="local">local</SelectItem> : null}
						</SelectContent>
					</Select>
					<input type="hidden" name="provider" value={provider} />
					{!allowLocalProvider ? (
						<p className="text-xs text-muted-foreground">
							`local` provider is available only in development mode.
						</p>
					) : null}
				</div>

				{provider === "smtp" ? (
					<>
						<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
							<div className="flex flex-col gap-2">
								<label className="text-sm font-medium" htmlFor="smtp_host">SMTP Host</label>
								<Input id="smtp_host" name="smtp_host" defaultValue={initialConfig.mail.smtp.host} required />
							</div>
							<div className="flex flex-col gap-2">
								<label className="text-sm font-medium" htmlFor="smtp_port">SMTP Port</label>
								<Input id="smtp_port" name="smtp_port" type="number" min={1} max={65535} defaultValue={initialConfig.mail.smtp.port} required />
							</div>
							<div className="flex flex-col gap-2">
								<label className="text-sm font-medium">SMTP Secure</label>
								<Select value={smtpSecure} onValueChange={setSmtpSecure}>
									<SelectTrigger>
										<SelectValue placeholder="Select secure mode" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="true">true</SelectItem>
										<SelectItem value="false">false</SelectItem>
									</SelectContent>
								</Select>
								<input type="hidden" name="smtp_secure" value={smtpSecure} />
							</div>
							<div className="flex flex-col gap-2">
								<label className="text-sm font-medium" htmlFor="smtp_user">SMTP User</label>
								<Input id="smtp_user" name="smtp_user" defaultValue={initialConfig.mail.smtp.user} required />
							</div>
							<div className="flex flex-col gap-2">
								<label className="text-sm font-medium" htmlFor="smtp_pass">SMTP Password</label>
								<Input id="smtp_pass" name="smtp_pass" type="password" defaultValue={initialConfig.mail.smtp.pass} required />
							</div>
						</div>
					</>
				) : null}

				{provider === "resend" ? (
					<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
						<div className="flex flex-col gap-2">
							<label className="text-sm font-medium" htmlFor="resend_api_key">Resend API Key</label>
							<Input id="resend_api_key" name="resend_api_key" type="password" defaultValue={initialConfig.mail.resend.apiKey} required />
						</div>
					</div>
				) : null}

				{allowLocalProvider && provider === "local" ? (
					<div className="grid grid-cols-1 gap-3 md:grid-cols-2">
						<div className="flex flex-col gap-2">
							<label className="text-sm font-medium" htmlFor="local_base_url">Local Worker Base URL (optional)</label>
							<Input id="local_base_url" name="local_base_url" defaultValue={initialConfig.mail.local.baseUrl || ""} />
						</div>
					</div>
				) : null}

				<Button type="submit" className="w-fit">Save Mail Provider Config</Button>
			</form>
		</div>
	);
}
