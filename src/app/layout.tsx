import type { Metadata } from "next";
import { Poppins, Montserrat, Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { ConditionalFooter } from "@/components/layout/ConditionalFooter";
import { MaziumWidgetLoader } from "@/components/features/MaziumWidgetLoader";
import { AutoDealerJsonLd } from "@/components/seo/JsonLd";

import { Providers } from "@/components/providers/Providers";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { AuthProvider } from "@/context/AuthContext";
import { ChatProvider } from "@/context/ChatContext";
import { CompareProvider } from "@/context/CompareContext";
import { LocationProvider } from "@/context/LocationContext";
import { PageViewTracker } from "@/components/analytics/PageViewTracker";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const inter = Inter({ subsets: ["latin"], display: "swap" })

export const metadata: Metadata = {
  metadataBase: new URL("https://carmazium.co.uk"),
  title: {
    default: "CarMazium — Buy & Sell Cars in London",
    template: "%s | CarMazium",
  },
  description:
    "London's trusted car marketplace. Browse thousands of verified vehicles, sell your car for free, and get the best deals with transparent pricing and seller reviews.",
  keywords: [
    "buy cars London",
    "sell car UK",
    "used cars",
    "car marketplace",
    "CarMazium",
    "cars for sale",
    "second hand cars London",
    "car dealer London",
  ],
  openGraph: {
    type: "website",
    locale: "en_GB",
    siteName: "CarMazium",
    title: "CarMazium — Buy & Sell Cars in London",
    description:
      "London's trusted car marketplace. Browse verified vehicles, sell for free, transparent pricing.",
    url: "https://carmazium.co.uk",
  },
  twitter: {
    card: "summary_large_image",
    title: "CarMazium — Buy & Sell Cars in London",
    description:
      "London's trusted car marketplace. Browse verified vehicles, sell for free, transparent pricing.",
  },
  robots: {
    index: true,
    follow: true,
  },
  other: {
    "geo.region": "GB-LND",
    "geo.placename": "London",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth overflow-x-hidden" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${inter.className} selection:bg-red-500/30 selection:text-red-200`}
      >
        <AutoDealerJsonLd />
        <ThemeProvider>
          <AuthProvider>
            <ChatProvider>
              <CompareProvider>
                <LocationProvider>
                  <PageViewTracker />
                  <div className="flex flex-col min-h-screen">
                    <Header />
                    <main className="flex-grow pt-20">
                      {children}
                    </main>
                    <ConditionalFooter />
                    <MaziumWidgetLoader />
                  </div>
                </LocationProvider>
              </CompareProvider>
            </ChatProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

