import type { Metadata } from "next";
import { Poppins, Montserrat, Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { StagingBanner } from "@/components/layout/StagingBanner";
import { OfflineBanner } from "@/components/layout/OfflineBanner";
import { ConditionalFooter } from "@/components/layout/ConditionalFooter";
import { MaziumWidgetLoader } from "@/components/features/MaziumWidgetLoader";
import { MarketingPopup } from "@/components/features/MarketingPopup";
import { LocationPromptModal } from "@/components/features/LocationPromptModal";
import { MarketplaceJsonLd } from "@/components/seo/JsonLd";

import { Providers } from "@/components/providers/Providers";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { AuthProvider } from "@/context/AuthContext";
import { ChatProvider } from "@/context/ChatContext";
import { CompareProvider } from "@/context/CompareContext";
import { LocationProvider } from "@/context/LocationContext";
import { PageViewTracker } from "@/components/analytics/PageViewTracker";
import { GoogleConsentMode } from "@/components/analytics/GoogleConsentMode";
import { GoogleTagManager } from "@/components/analytics/GoogleTagManager";
import { GoogleAnalytics } from "@/components/analytics/GoogleAnalytics";
import { MetaPixel } from "@/components/analytics/MetaPixel";
import { TikTokPixel } from "@/components/analytics/TikTokPixel";
import { CookieConsentBanner } from "@/components/analytics/CookieConsentBanner";
import { ConsentProvider } from "@/context/ConsentContext";
import { ProductSyncBridge } from "@/components/providers/ProductSyncBridge";

// Canonical SEO origin. The apex domain permanently redirects to this host.
const SITE_URL = "https://www.carmazium.com";

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
  metadataBase: new URL(SITE_URL),
  title: {
    default: "CarMazium | Sell Your Car or Buy Used Cars in the UK",
    template: "%s | CarMazium",
  },
  description:
    "Sell your car online in the UK with a free dealer auction or £1 retail listing, or browse used cars from verified sellers on CarMazium.",
  keywords: [
    "sell my car",
    "sell car online UK",
    "car auction UK",
    "sell car to dealers",
    "buy used cars UK",
    "used cars for sale UK",
    "car marketplace UK",
    "CarMazium",
  ],
  openGraph: {
    type: "website",
    locale: "en_GB",
    siteName: "CarMazium",
    title: "CarMazium | Sell Your Car or Buy Used Cars in the UK",
    description:
      "Sell your car through a free dealer auction or £1 retail listing, or browse used cars from verified sellers across the UK.",
  },
  twitter: {
    card: "summary_large_image",
    title: "CarMazium | Sell Your Car or Buy Used Cars in the UK",
    description:
      "Free dealer auctions, £1 retail listings and used cars from verified sellers across the UK.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
  },
  other: {
    "geo.region": "GB",
    "geo.placename": "United Kingdom",
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
        <a
          href="#main-content"
          className="sr-only fixed left-4 top-4 z-[200] rounded-lg bg-primary px-4 py-3 font-bold text-white shadow-xl focus:not-sr-only"
        >
          Skip to main content
        </a>
        <MarketplaceJsonLd />
        <ConsentProvider>
          {/* MUST stay first: sets Consent Mode v2 defaults into the
              dataLayer before any Google tag loads. Moving it below
              GoogleAnalytics makes the defaults arrive too late to apply. */}
          <GoogleConsentMode />
          <GoogleTagManager />
          <GoogleAnalytics />
          <MetaPixel />
          <TikTokPixel />
          <ThemeProvider>
            <AuthProvider>
              <ChatProvider>
                <CompareProvider>
                  <LocationProvider>
                    <ProductSyncBridge />
                    <PageViewTracker />
                    <div className="flex flex-col min-h-screen">
                      {/* Above the header on purpose: on staging this must be
                          the first thing seen, before anything that looks like
                          the real site. Renders nothing on production. */}
                      <StagingBanner />
                      <OfflineBanner />
                      <Header />
                      <main id="main-content" tabIndex={-1} className="flex-grow pt-20">
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
