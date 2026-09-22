import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title:"Utsavaloka", description:"The connected campus operating system." };
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}