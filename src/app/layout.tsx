import type { Metadata } from "next";
import { Inter, Outfit, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/layout/Providers";
import Sidebar from "@/components/layout/Sidebar";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  title: "JannikJBI Todo",
  description: "Asset Management für dein Projekt",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" className="dark">
      <body className={`${inter.variable} ${outfit.variable} ${jetbrains.variable} font-outfit bg-[#0a0c14] text-slate-200 antialiased`}>
        <Providers>
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 transition-all duration-300 ml-64 max-md:ml-0">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
