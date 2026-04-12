import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { AppProviders } from "./providers/AppProviders";
import "./globals.css";
import "leaflet/dist/leaflet.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://apexmonitor.tech'),
  title: {
    default: 'ApexMonitor',
    template: '%s | ApexMonitor',
  },
  description: 'ApexMonitor command center for logs, traces, analytics, and live traffic monitoring.',
  keywords: ['observability', 'monitoring', 'apm', 'logs', 'traces', 'real-time analytics'],
  applicationName: 'ApexMonitor',
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: 'ApexMonitor',
    description: 'Real-time observability for modern systems.',
    type: 'website',
    siteName: 'ApexMonitor',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ApexMonitor',
    description: 'Real-time observability for modern systems.',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
