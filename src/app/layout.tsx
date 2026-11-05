import type { Metadata } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const serif = Fraunces({ variable: "--font-serif-display", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FrostedFlakes",
  description: "The AI notepad for people in back-to-back meetings.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} ${serif.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
