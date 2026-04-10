import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClaimIQ — Multi-Agent Orchestrator",
  description: "AI-powered insurance claim processing with multi-agent orchestration",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
