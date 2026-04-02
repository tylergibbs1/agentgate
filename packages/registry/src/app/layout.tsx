import { cn } from "@/lib/utils";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
	title: "AgentGate Registry",
	description: "Browse APIs and their capabilities for AI agents",
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="en" className={cn("dark", geist.variable, geistMono.variable)}>
			<body className="bg-background text-foreground min-h-screen font-sans antialiased">
				<div className="mx-auto max-w-4xl px-6 py-8">
					<header className="mb-8 border-b border-border pb-6">
						<a href="/" className="no-underline">
							<h1 className="text-2xl font-bold tracking-tight">
								AgentGate Registry
							</h1>
						</a>
						<p className="mt-1 text-sm text-muted-foreground">
							Browse APIs and their capabilities for AI agents
						</p>
					</header>
					{children}
				</div>
			</body>
		</html>
	);
}
