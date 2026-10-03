import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'HELIOS | API Intelligence & Security Platform',
  description: 'Enterprise-grade API intelligence, security audit, compatibility, and local AI assistant platform.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 antialiased">{children}</body>
    </html>
  );
}
