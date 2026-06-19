import { Button } from "@/components/ui/button";
import type { SystemSettingsV1 } from "@/lib/system-settings";

type DomainSettingsFormProps = {
	initialSettings: SystemSettingsV1;
	saveAction: (formData: FormData) => Promise<void>;
};

export function DomainSettingsForm({ initialSettings, saveAction }: DomainSettingsFormProps) {
	return (
		<div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
			<div className="mb-4 space-y-1">
				<h2 className="text-lg font-medium">Domain Settings</h2>
				<p className="text-sm text-muted-foreground">
					Configure the domain suffixes users can choose for temporary email addresses.
				</p>
			</div>

			<form action={saveAction} className="flex max-w-xl flex-col gap-4">
				<div className="flex flex-col gap-2">
					<label className="text-sm font-medium" htmlFor="email_domains">
						Temporary Email Domains
					</label>
					<textarea
						id="email_domains"
						name="email_domains"
						defaultValue={initialSettings.mail.emailDomains.join("\n")}
						placeholder="example.com, mail.example.com"
						className="min-h-28 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
					/>
					<p className="text-xs text-muted-foreground">
						Separate multiple domains with commas or new lines. A leading @ is optional.
					</p>
				</div>

				<Button type="submit" className="w-fit">
					Save Domain Settings
				</Button>
			</form>
		</div>
	);
}
