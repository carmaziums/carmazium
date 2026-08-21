import type { Metadata } from "next";
import { Poppins, Montserrat, Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { ConditionalFooter } from "@/components/layout/ConditionalFooter";
import { MaziumWidgetLoader } from "@/components/features/MaziumWidgetLoader";
import { MarketingPopup } from "@/components/features/MarketingPopup";
import { LocationPromptModal } from "@/components/features/LocationPromptModal";
import { AutoDealerJsonLd } from "@/components/seo/JsonLd";

import { Providers } from "@/components/providers/Providers";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { AuthProvider } from "@/context/AuthContext";
import { ChatProvider } from "@/context/ChatContext";
import { CompareProvider } from "@/context/CompareContext";
import { LocationProvider } from "@/context/LocationContext";
import { PageViewTracker } from "@/components/analytics/PageViewTracker";
import { GoogleTagManager } from "@/components/analytics/GoogleTagManager";
import { GoogleAnalytics } from "@/components/analytics/GoogleAnalytics";
import { MetaPixel } from "@/components/analytics/MetaPixel";
import { TikTokPixel } from "@/components/analytics/TikTokPixel";
import { CookieConsentBanner } from "@/components/analytics/CookieConsentBanner";
import { ConsentProvider } from "@/context/ConsentContext";

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
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://carmazium.com"),
  title: {
    default: "CarMazium — Buy & Sell Cars in UK",
    template: "%s | CarMazium",
  },
  description:
    "UK's trusted car marketplace. Browse thousands of verified vehicles, sell your car for free, and get the best deals with transparent pricing and seller reviews.",
  keywords: [
    "buy cars UK",
    "sell car UK",
    "used cars",
    "car marketplace",
    "CarMazium",
    "cars for sale",
    "second hand cars UK",
    "car dealer UK",
  ],
  openGraph: {
    type: "website",
    locale: "en_GB",
    siteName: "CarMazium",
    title: "CarMazium — Buy & Sell Cars in UK",
    description:
      "UK's trusted car marketplace. Browse verified vehicles, sell for free, transparent pricing.",
    url: process.env.NEXT_PUBLIC_APP_URL || "https://carmazium.com",
  },
  twitter: {
    card: "summary_large_image",
    title: "CarMazium — Buy & Sell Cars in UK",
    description:
      "UK's trusted car marketplace. Browse verified vehicles, sell for free, transparent pricing.",
  },
  robots: {
    index: true,
    follow: true,
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
  },
  other: {
    "geo.region": "GB",
    "geo.placename": "UK",
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
        <ConsentProvider>
          <GoogleTagManager />
          <GoogleAnalytics />
          <MetaPixel />
          <TikTokPixel />
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
                      <MarketingPopup />
                      <LocationPromptModal />
                      <CookieConsentBanner />
                    </div>
                  </LocationProvider>
                </CompareProvider>
              </ChatProvider>
            </AuthProvider>
          </ThemeProvider>
        </ConsentProvider>
      </body>
    </html>
  );
}

