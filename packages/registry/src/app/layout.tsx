import { cn } from "@/lib/utils";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
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
		<html
			lang="en"
			className={cn("dark", geist.variable, geistMono.variable)}
		>
			<body className="min-h-screen font-sans antialiased">
				<div className="mx-auto max-w-4xl px-6 py-10">
					<header className="mb-10 border-b pb-6">
						<Link href="/" className="no-underline">
							<h1 className="text-3xl font-bold tracking-tight">
								AgentGate
							</h1>
						</Link>
						<p className="mt-1.5 text-sm text-muted-foreground">
							Browse APIs and their capabilities for AI agents
						</p>
					</header>
					{children}
				</div>
			</body>
		</html>
	);
}
