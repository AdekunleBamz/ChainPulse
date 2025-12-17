import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ChainPulse - Chainhook Activity Tracker",
  description: "Real-time blockchain activity tracking powered by Hiro Chainhooks on Stacks",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
