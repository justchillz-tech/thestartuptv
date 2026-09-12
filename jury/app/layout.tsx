import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Startup TV | Jury Portal",
  description: "Startup TV Short Film Festival jury evaluation portal.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
