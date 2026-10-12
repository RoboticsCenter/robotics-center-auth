import type { Metadata, Viewport } from "next";
import { DM_Sans, Genos, Share_Tech } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-dm-sans",
});
const shareTech = Share_Tech({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  variable: "--font-share-tech",
});
const genos = Genos({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-genos",
});

export const metadata: Metadata = {
  title: {
    default: "Sign in | Robotics Center of Silicon Valley",
    template: "%s | Robotics Center of Silicon Valley",
  },
  description:
    "Secure access to the Robotics Center of Silicon Valley product family.",
  robots: {
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#06182f",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${shareTech.variable} ${genos.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
