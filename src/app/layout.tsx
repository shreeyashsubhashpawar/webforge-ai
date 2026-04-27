import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { WizardProvider } from "@/store/WizardContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "WebForge AI - Intelligent Website Generator",
  description: "AI-powered web development platform using RAG and intent classification to generate high-quality, production-ready websites from natural language prompts.",
  keywords: ["AI", "web development", "code generation", "RAG", "Claude AI", "automated SDLC"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <WizardProvider>{children}</WizardProvider>
      </body>
    </html>
  );
}
