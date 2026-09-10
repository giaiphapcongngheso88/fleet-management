import { Outfit } from 'next/font/google';
import type { Metadata } from 'next';
import './globals.css';

import { SidebarProvider } from '@/context/SidebarContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { FeedbackDialogProvider } from './lib/feedback-dialog-provider';

const outfit = Outfit({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Đại Phát - Quản lý vận tải",
  description: "Hệ thống quản lý vận tải Đại Phát",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className={`${outfit.className} dark:bg-gray-900`}>
        <ThemeProvider>
          <SidebarProvider><FeedbackDialogProvider>{children}</FeedbackDialogProvider></SidebarProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
