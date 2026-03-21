import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { MainLayout } from "@/components/layout/main-layout";
import { getDb } from "@/lib/db";
import { userEmails } from "@/lib/schema";
import { eq } from "drizzle-orm";

export default async function MailLayoutWrapper({
	children,
}: {
	children: React.ReactNode;
}) {
	const reqHeaders = await headers();
	const session = await getAuth().api.getSession({ headers: reqHeaders });
	if (!session) {
		redirect("/");
	}

	const db = getDb();
	const emails = await db.select()
		.from(userEmails)
		.where(eq(userEmails.userId, session.user.id))
		.all();
	if (emails.length === 0) {
		redirect("/onboard");
	}

	const emailAddresses = emails.map(e => e.emailAddress);

	return (
		<MainLayout
			userName={session.user.name}
			userEmail={session.user.email}
			userImage={session.user.image || undefined}
			userEmailAccounts={emailAddresses}
		>
			{children}
		</MainLayout>
	);
}
