import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAllServices } from "@/lib/specs";

export const dynamic = "force-dynamic";

export default async function HomePage() {
	const services = await getAllServices();
	const totalIntents = services.reduce((sum, s) => sum + s.intentCount, 0);

	return (
		<main>
			<p className="mb-6 text-sm text-muted-foreground">
				{services.length} services &middot; {totalIntents} intents available
			</p>

			<div className="grid gap-4">
				{services.map((svc) => (
					<a
						key={svc.name}
						href={`/${svc.name}`}
						className="group block no-underline"
					>
						<Card className="transition-colors hover:border-primary/40">
							<CardHeader className="pb-2">
								<div className="flex items-baseline justify-between">
									<CardTitle className="text-lg">{svc.name}</CardTitle>
									<Badge variant="secondary">
										{svc.intentCount} intent{svc.intentCount !== 1 ? "s" : ""}
									</Badge>
								</div>
							</CardHeader>
							<CardContent>
								<p className="text-sm text-muted-foreground">
									{svc.description}
								</p>
								<div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground/60">
									<code className="font-mono">{svc.baseUrl}</code>
									<span>&middot;</span>
									<Badge variant="outline" className="text-[0.65rem]">
										{svc.authType}
									</Badge>
								</div>
							</CardContent>
						</Card>
					</a>
				))}
			</div>
		</main>
	);
}
