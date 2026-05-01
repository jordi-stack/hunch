import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { StatusPanel } from "./components/StatusPanel";
import "./globals.css";

const geist = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hunch",
  description: "Your hunch, smarter. Agent dashboard for Solana onchain reasoning.",
  icons: {
    icon: "/favicon-32.png",
    shortcut: "/favicon-16.png",
    apple: "/logo.png",
  },
};

const NAV_ITEMS = [
  { href: "/", label: "Activity", icon: ActivityIcon },
  { href: "/history", label: "History", icon: HistoryIcon },
  { href: "/memory", label: "Memory", icon: MemoryIcon },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geist.variable} ${geistMono.variable} font-sans bg-surface-0 text-text-primary min-h-screen antialiased`}
      >
        <div className="flex min-h-screen">
          {/* Sidebar */}
          <aside className="fixed top-0 left-0 h-screen w-60 border-r border-white/5 bg-surface-1 flex flex-col z-50">
            {/* Logo */}
            <div className="px-5 py-5 flex items-center gap-3">
              <img src="/logo.png" alt="Hunch" className="w-8 h-8 rounded-lg" />
              <span className="text-lg font-semibold tracking-tight">Hunch</span>
              <div className="ml-auto flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse-glow" />
                <span className="text-xs text-accent-green font-medium">Live</span>
              </div>
            </div>

            <div className="gradient-line mx-5" />

            {/* Nav */}
            <nav className="flex-1 px-3 py-4 space-y-1">
              {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
                <a
                  key={href}
                  href={href}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-white/[0.04] transition-all duration-200 group"
                >
                  <Icon className="w-4 h-4 text-text-muted group-hover:text-accent-purple transition-colors" />
                  {label}
                </a>
              ))}
            </nav>

            {/* Status Panel */}
            <StatusPanel />

            {/* Footer */}
            <div className="px-5 py-4 border-t border-white/5">
              <div className="flex items-center gap-2 text-xs text-text-muted">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-purple" />
                <span>Single-user mode</span>
              </div>
            </div>
          </aside>

          {/* Main */}
          <main className="flex-1 ml-60">
            <div className="max-w-[1200px] mx-auto px-8 py-8">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}

function ActivityIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 8h2.5l2-4 3 8 2-4H14" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HistoryIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="5.5" />
      <path d="M8 5v3.5l2.5 1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MemoryIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" strokeLinecap="round" />
      <circle cx="5.5" cy="4.5" r="1" fill="currentColor" />
      <circle cx="10.5" cy="8" r="1" fill="currentColor" />
      <circle cx="7" cy="11.5" r="1" fill="currentColor" />
    </svg>
  );
}
