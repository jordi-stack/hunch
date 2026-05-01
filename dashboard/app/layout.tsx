import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hunch Dashboard",
  description: "Activity feed, decision history, and memory inspector for Hunch",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-gray-100 min-h-screen">
        <nav className="border-b border-gray-800 px-6 py-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <a href="/" className="text-xl font-bold text-white">
              Hunch
            </a>
            <div className="flex gap-6">
              <a
                href="/"
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Activity
              </a>
              <a
                href="/history"
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                History
              </a>
              <a
                href="/memory"
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Memory
              </a>
            </div>
          </div>
        </nav>
        <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
