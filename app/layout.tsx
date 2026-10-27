import type { Metadata } from "next";
import localFont from "next/font/local";
import { Geist_Mono } from "next/font/google";
import "./globals.css";

const figtree = localFont({
  src: [
    {
      path: "./fonts/Figtree-VariableFont_wght.ttf",
      weight: "300 900",
      style: "normal",
    },
    {
      path: "./fonts/Figtree-Italic-VariableFont_wght.ttf",
      weight: "300 900",
      style: "italic",
    },
  ],
  variable: "--font-figtree",
  display: "swap",
});

const instrumentSans = localFont({
  src: [
    {
      path: "./fonts/InstrumentSans-VariableFont_wdth,wght.ttf",
      weight: "400 700",
      style: "normal",
    },
    {
      path: "./fonts/InstrumentSans-Italic-VariableFont_wdth,wght.ttf",
      weight: "400 700",
      style: "italic",
    },
  ],
  variable: "--font-instrument-sans",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Amend Member Network",
  description: "Private, role-gated member platform",
};

export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      className={`${figtree.variable} ${instrumentSans.variable} ${geistMono.variable}`}
      lang="en"
    >
      <body>{children}</body>
    </html>
  );
}
