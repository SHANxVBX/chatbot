
"use client"; // This component now uses a client-side hook

import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from '@/hooks/useAuth';
import { useAntiInspection } from '@/hooks/useAntiInspection'; // New import

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

// Metadata cannot be exported from a Client Component.
// It should be defined in a Server Component or via generateMetadata function.
// For a global layout like this, if it must be a client component,
// consider moving metadata to a higher-level Server Component if possible,
// or manage document head tags directly using 'next/head' if truly necessary for client-side updates,
// though the Next.js App Router encourages server-defined metadata.

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  useAntiInspection(); // Call the hook here

  return (
    <html lang="en" className="dark">
      <head>
        <title>CyberChat AI</title>
        <meta name="description" content="Futuristic AI Chat Application" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased font-sans`}>
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}

