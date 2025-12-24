import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Recut — repurpose long videos into short clips",
  description:
    "Automatically analyze long-form videos and produce short clips optimized for YouTube Shorts, Instagram Reels, and TikTok.",
  keywords: ["recut", "video", "shorts", "clips", "trim", "youtube"],
  authors: [{ name: "Ruxsoraxon Kenjayeva" }],
  openGraph: {
    title: "Recut — repurpose long videos into short clips",
    description:
      "Automatically analyze long-form videos and produce short clips optimized for social platforms.",
    url: "https://recut.ruxsoraxon.uz/",
    siteName: "Recut",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}

