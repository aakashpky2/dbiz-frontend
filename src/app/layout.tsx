import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { SidebarProvider } from "@/components/ui/sidebar";
import Script from 'next/script';
import { ThemeProvider } from '@/components/providers/theme-provider';

export const metadata: Metadata = {
  title: {
    default: 'D BIZ OFFICE | Professional Office Manager',
    template: '%s | D BIZ OFFICE'
  },
  description: 'Manage your workflow, tasks, and employees efficiently with D BIZ OFFICE.',
  keywords: ['Office Management', 'Workflow', 'Task Manager', 'Employee Management', 'Business Operations'],
  authors: [{ name: 'D BIZ' }],
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://dbizoffice.com'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: '/',
    title: 'D BIZ OFFICE - Professional Office Manager',
    description: 'Manage your workflow, tasks, and employees efficiently with D BIZ OFFICE.',
    siteName: 'D BIZ OFFICE'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'D BIZ OFFICE - Professional Office Manager',
    description: 'Manage your workflow, tasks, and employees efficiently with D BIZ OFFICE.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: '/imgfav.png',
    shortcut: '/imgfav.png',
    apple: '/imgfav.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#ffffff',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

import QueryProvider from '@/components/providers/query-provider';
import { AppTransitionProvider } from '@/contexts/AppTransitionContext';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "D BIZ OFFICE",
    "url": "https://dbizoffice.com",
    "logo": "https://dbizoffice.com/logo.png",
    "description": "Professional Office Manager for tracking workflows and employee tasks.",
    "sameAs": []
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${GeistSans.variable} antialiased`} suppressHydrationWarning>
        <Script id="org-schema" type="application/ld+json" strategy="afterInteractive">
          {JSON.stringify(structuredData)}
        </Script>
        <ThemeProvider>
          <QueryProvider>
            <AppTransitionProvider>
              <SidebarProvider defaultOpen>
                {children}
              </SidebarProvider>
            </AppTransitionProvider>
          </QueryProvider>
        </ThemeProvider>
        <Toaster />
      </body>
    </html>
  );
}
