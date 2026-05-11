import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HealthIntel Appeals Copilot",
  description: "AI-powered appeals decision support prototype"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
