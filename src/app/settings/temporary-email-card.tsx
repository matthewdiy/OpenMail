"use client";

import { RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

type TemporaryEmailCardProps = {
	domains: string[];
	isAdmin: boolean;
	createAction: (formData: FormData) => Promise<void>;
};

const FIRST_NAMES = [
	"aaron", "abby", "adam", "adrian", "aiden", "alex", "alice", "alina", "amelia", "andrew",
	"anna", "anthony", "aria", "arthur", "asher", "audrey", "ava", "ben", "bella", "blake",
	"brandon", "brianna", "brooke", "caleb", "camila", "carter", "charles", "charlotte",
	"chloe", "claire", "connor", "daniel", "david", "dylan", "edward", "eleanor", "elena",
	"eli", "elijah", "ella", "emily", "emma", "ethan", "eva", "evelyn", "felix", "finn",
	"gabriel", "grace", "hailey", "hannah", "harper", "henry", "hudson", "ian", "isabella",
	"ivy", "jack", "jacob", "james", "jasmine", "jason", "john", "jonah", "joseph", "julia",
	"kai", "katherine", "kevin", "leah", "leo", "liam", "lily", "logan", "lucas", "lucy",
	"luna", "madison", "maya", "mia", "michael", "mila", "nathan", "nora", "oliver",
	"olivia", "owen", "parker", "penelope", "quinn", "riley", "ruby", "ryan", "samuel",
	"sara", "scarlett", "sebastian", "sophia", "stella", "theo", "thomas", "victoria",
	"violet", "william", "zoe",
];

const LAST_NAMES = [
	"adams", "allen", "anderson", "bailey", "baker", "bennett", "brooks", "brown", "campbell",
	"carter", "chen", "clark", "collins", "cooper", "cruz", "davis", "diaz", "edwards",
	"evans", "fisher", "flores", "foster", "garcia", "gomez", "gray", "green", "griffin",
	"hall", "harris", "hayes", "hernandez", "hill", "hughes", "jackson", "jenkins",
	"johnson", "jones", "kelly", "kim", "king", "lee", "lewis", "li", "long", "lopez",
	"martin", "martinez", "miller", "mitchell", "moore", "morgan", "murphy", "nelson",
	"nguyen", "ortiz", "parker", "patel", "perez", "peterson", "phillips", "powell",
	"price", "ramirez", "reed", "reyes", "rivera", "roberts", "robinson", "rodriguez",
	"ross", "sanders", "scott", "smith", "stewart", "sullivan", "taylor", "thomas",
	"thompson", "torres", "turner", "walker", "ward", "watson", "white", "williams",
	"wilson", "wood", "wright", "wu", "young", "zhang",
];

function randomSuffix() {
	const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
	return Array.from({ length: 5 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

function sampleName() {
	const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
	const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
	return { firstName, lastName };
}

function buildEmailName(firstName: string, lastName: string) {
	return `${firstName}${lastName}${randomSuffix()}`;
}

const INITIAL_SAMPLED_NAME = { firstName: "alex", lastName: "smith" };

export function TemporaryEmailCard({ domains, isAdmin, createAction }: TemporaryEmailCardProps) {
	const hasDomains = domains.length > 0;
	const [sampledName, setSampledName] = useState(INITIAL_SAMPLED_NAME);
	const [emailName, setEmailName] = useState(() =>
		buildEmailName(INITIAL_SAMPLED_NAME.firstName, INITIAL_SAMPLED_NAME.lastName)
	);
	const [domain, setDomain] = useState(domains[0] ?? "");
	const previewAddress = useMemo(
		() => (domain ? `${emailName || "email-name"}@${domain}` : ""),
		[emailName, domain]
	);

	function regenerateEmailName() {
		const nextName = sampleName();
		setSampledName(nextName);
		setEmailName(buildEmailName(nextName.firstName, nextName.lastName));
	}

	useEffect(() => {
		regenerateEmailName();
	}, []);

	return (
		<div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
			<div className="mb-4 space-y-1">
				<h2 className="text-lg font-medium">Temporary Email</h2>
				<p className="text-sm text-muted-foreground">
					Create a short-lived receiving address linked to your account.
				</p>
			</div>

			{hasDomains ? (
				<form action={createAction} className="flex flex-col gap-4">
					<div className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-neutral-900/40">
						<div className="text-xs font-medium uppercase text-muted-foreground">Sampled name</div>
						<div className="mt-1 text-sm font-medium capitalize">
							{sampledName.firstName} {sampledName.lastName}
						</div>
					</div>

					<div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
						<div className="flex flex-col gap-2">
							<label htmlFor="email_name" className="text-sm font-medium">
								Email name
							</label>
							<div className="flex gap-2">
								<Input
									id="email_name"
									name="email_name"
									value={emailName}
									onChange={(event) =>
										setEmailName(event.target.value.toLowerCase().replace(/[^a-z0-9._+-]/g, ""))
									}
									required
								/>
								<Button
									type="button"
									variant="outline"
									size="icon"
									className="h-10 w-10 shrink-0"
									onClick={regenerateEmailName}
									aria-label="Regenerate temporary email name"
									title="Regenerate"
								>
									<RefreshCw className="h-4 w-4" />
								</Button>
							</div>
						</div>
						<div className="flex flex-col gap-2">
							<label className="text-sm font-medium">Domain</label>
							<Select value={domain} onValueChange={setDomain}>
								<SelectTrigger>
									<SelectValue placeholder="Select domain" />
								</SelectTrigger>
								<SelectContent>
									{domains.map((item) => (
										<SelectItem key={item} value={item}>
											@{item}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<input type="hidden" name="email_domain" value={domain} />
						</div>
					</div>

					<div className="flex flex-col gap-2">
						<label htmlFor="expire_day" className="text-sm font-medium">
							Expires after days
						</label>
						<Input
							id="expire_day"
							name="expire_day"
							type="number"
							min={1}
							defaultValue={1}
							placeholder="1"
							required
							className="max-w-[120px]"
						/>
					</div>

					<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
						<p className="text-sm text-muted-foreground">{previewAddress}</p>
						<Button type="submit" className="w-fit">
							Create
						</Button>
					</div>
				</form>
			) : (
				<div className="rounded-md border border-dashed border-gray-200 p-4 text-sm text-muted-foreground dark:border-gray-800">
					{isAdmin
						? "Add temporary email domains in Admin Settings before creating temporary addresses."
						: "Temporary email addresses are not available yet."}
				</div>
			)}
		</div>
	);
}
