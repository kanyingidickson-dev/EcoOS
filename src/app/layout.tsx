import type { Metadata } from "next";
import { Outfit, Inter } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "600", "800", "900"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "EcoOS Intelligence | Real-Time Behavioral OS for Climate Action",
  description:
    "A next-gen AI-powered sustainability platform that turns environmental intention into measurable action. Track your carbon footprint, optimize routes, simulate what-if scenarios, and get personalized coaching — all powered by Google Gemini 2.0 Flash.",
  keywords: [
    "sustainability",
    "carbon footprint",
    "AI",
    "climate action",
    "EcoOS",
    "Google Gemini",
    "recycling",
    "green living",
    "carbon calculator",
    "Earth Day",
  ],
  authors: [{ name: "EcoOS Intelligence Team" }],
  openGraph: {
    title: "EcoOS Intelligence | Real-Time Behavioral OS for Climate Action",
    description:
      "What if every daily decision showed its carbon cost instantly? EcoOS bridges intention and action with AI.",
    type: "website",
    siteName: "EcoOS Intelligence",
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
      className={`${outfit.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans no-scrollbar">
        {children}
      </body>
    </html>
  );
}
