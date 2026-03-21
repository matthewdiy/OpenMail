import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { MainLayout } from "@/components/layout/main-layout";

export default async function SettingsLayoutWrapper({
	children,
}: {
	children: React.ReactNode;
}) {
	const reqHeaders = await headers();
	const session = await getAuth().api.getSession({ headers: reqHeaders });
	if (!session) {
		redirect("/");
	}

	return (
		<MainLayout 
			userName={session.user.name} 
			userEmail={session.user.email} 
			userImage={session.user.image || undefined}
		>
			{children}
		</MainLayout>
	);
}
