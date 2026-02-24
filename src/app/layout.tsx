import type { Metadata } from "next";
import { Poppins, Montserrat, Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { ConditionalFooter } from "@/components/layout/ConditionalFooter";
import { MaziumWidget } from "@/components/features/MaziumWidget";

import { Providers } from "@/components/providers/Providers";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { AuthProvider } from "@/context/AuthContext";
import { ChatProvider } from "@/context/ChatContext";
import { CompareProvider } from "@/context/CompareContext";

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

const inter = Inter({ subsets: ["latin"] })

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
    <html lang="en" className="scroll-smooth" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${inter.className} selection:bg-red-500/30 selection:text-red-200`}
      >
        <ThemeProvider>
          <AuthProvider>
            <ChatProvider>
              <CompareProvider>
                <div className="flex flex-col min-h-screen">
                  <Header />
                  <main className="flex-grow pt-20">
                    {children}
                  </main>
                  <ConditionalFooter />
                </div>
              </CompareProvider>
            </ChatProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

