import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Low Carbon Materials Hub",
  description: "Traceable EPD comparison for concrete products"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
