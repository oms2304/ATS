import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { AuthProvider } from '@/context/AuthContext';
import './globals.css';

const plusJakarta = Plus_Jakarta_Sans({
  variable: '--font-plus-jakarta',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'ATS for Candidates',
  description: 'Run your job search like a professional campaign.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${plusJakarta.variable} h-full antialiased font-sans`}
    >
      <body
        suppressHydrationWarning
        className="min-h-full flex flex-col bg-[#0d1117] text-[#e6edf3]"
        style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
      >
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
