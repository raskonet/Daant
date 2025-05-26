// src/app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css"; // Make sure this path is correct

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Dental DICOM Viewer",
  description: "View and annotate dental X-ray DICOM images.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full w-full">
      <body
        className={`${inter.className} h-full w-full bg-primary-dark text-text-primary antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
