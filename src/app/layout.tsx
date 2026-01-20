import type { Metadata } from "next";
import { Poppins, Montserrat } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { MaziumWidget } from "@/components/features/MaziumWidget";

import { Providers } from "@/components/providers/Providers";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "CarMazium - Rent Modern Luxury Cars",
  description: "Find your next car — fast, fair, transparent.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${poppins.variable} ${montserrat.variable} antialiased bg-slate-900 text-white min-h-screen flex flex-col no-scrollbar`}
      >
        <Providers>
          <Header />
          <main className="flex-grow pt-20">
            {children}
          </main>
          <Footer />
          <MaziumWidget />
        </Providers>
      </body>
    </html>
  );
}
