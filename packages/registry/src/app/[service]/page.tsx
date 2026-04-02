import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getService } from "@/lib/specs";
import { notFound } from "next/navigation";

export default async function ServicePage({
	params,
}: {
	params: Promise<{ service: string }>;
}) {
	const { service: serviceName } = await params;
	const svc = await getService(serviceName);
	if (!svc) notFound();

	return (
		<main>
			<a href="/">
				<Button variant="ghost" size="sm" className="mb-4 -ml-2">
					&larr; All services
				</Button>
			</a>

			<div className="mb-8">
				<h2 className="text-3xl font-bold tracking-tight">{svc.name}</h2>
				<p className="mt-1 text-muted-foreground">{svc.description}</p>
				<div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground/60">
					<code className="font-mono text-xs">{svc.baseUrl}</code>
					<span>&middot;</span>
					<Badge variant="outline" className="text-[0.65rem]">
						{svc.authType}
					</Badge>
				</div>
			</div>

			<h3 className="mb-4 text-lg font-semibold">
				Intents ({svc.intentCount})
			</h3>

			<div className="grid gap-4">
				{svc.intents.map((intent) => (
					<Card key={intent.id}>
						<CardHeader className="pb-2">
							<div className="flex items-baseline justify-between gap-2">
								<CardTitle className="font-mono text-base">
									{intent.id}
								</CardTitle>
								<Badge
									variant="secondary"
									className="shrink-0 font-mono text-[0.65rem]"
								>
									{intent.method} {intent.path}
								</Badge>
							</div>
						</CardHeader>
						<CardContent className="space-y-3">
							<p className="text-sm text-muted-foreground">
								{intent.description}
							</p>
							<div>
								<span className="text-xs text-muted-foreground/60">
									Patterns
								</span>
								<div className="mt-1 flex flex-wrap gap-1.5">
									{intent.patterns.map((p) => (
										<code
											key={p}
											className="rounded bg-accent px-1.5 py-0.5 font-mono text-xs text-accent-foreground"
										>
											{p}
										</code>
									))}
								</div>
							</div>
							{intent.paramCount > 0 && (
								<p className="text-xs text-muted-foreground/50">
									{intent.paramCount} parameter
									{intent.paramCount > 1 ? "s" : ""}
								</p>
							)}
						</CardContent>
					</Card>
				))}
			</div>
		</main>
	);
}
