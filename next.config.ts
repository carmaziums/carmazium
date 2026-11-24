import type { NextConfig } from "next";
import approvedAndroidDownloads from "./scripts/approved-android-downloads.json";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return approvedAndroidDownloads.releases.map((release) => ({
      source: "/downloads/" + release.filename,
      headers: [
        { key: "Content-Type", value: "application/vnd.android.package-archive" },
        { key: "Content-Disposition", value: 'attachment; filename="' + release.filename + '"' },
        { key: "Cache-Control", value: "public, max-age=31536000, immutable, no-transform" },
        { key: "X-Content-Type-Options", value: "nosniff" },
      ],
    }));
  },
  async rewrites() {
    return [
      {
        source: '/.well-known/assetlinks.json',
        destination: '/api/app-links/android',
      },
      {
        source: '/.well-known/apple-app-site-association',
        destination: '/api/app-links/apple',
      },
      // Array rewrites run AFTER filesystem routes: verified public/downloads
      // assets win. Keep the existing external fallback for older release links
      // that are not retained in the reviewed static-download manifest.
      {
        source: '/downloads/:name(CarMazium-\\d+\\.\\d+\\.\\d+-v\\d+).apk',
        destination: 'https://github.com/carmaziums/carmazium/releases/download/:name/:name.apk',
      },
    ];
  },
  async redirects() {
    return [
      // Both declared app-link hosts must serve association files directly.
      // Keep canonical www redirects for all other apex requests.
      {
        source: '/:path((?!\\.well-known/(?:assetlinks\\.json|apple-app-site-association)$).*)',
        has: [{ type: 'host', value: 'carmazium\\.com' }],
        destination: 'https://www.carmazium.com/:path',
        permanent: true,
      },
      // Retired duplicate hub; exact path only, never redirect service details or jobs.
      { source: '/services', destination: '/auctions', permanent: true },
      { source: '/finance', destination: '/services/finance', permanent: true },
        { source: '/services/jobs/new', destination: '/auctions#request-services', permanent: true },
      {
        source: '/index.html',
        destination: '/',
        permanent: true,
      },
      {
        source: '/index.htm',
        destination: '/',
        permanent: true,
      },
      {
        source: '/index.php',
        destination: '/',
        permanent: true,
      },
      // Retired pages: keep old bookmarks working instead of returning 404.
      // /dashboard/admin/* stays behind AdminAccessGate and admin-only APIs.
      {
        source: '/admin/analytics',
        destination: '/dashboard/admin/analytics',
        permanent: true,
      },
      {
        source: '/auth/partners',
        destination: '/auth/login',
        permanent: true,
      },
    ];
  },
  images: {
    // Vercel's Image Optimization quota has been exhausted repeatedly (402/403
    // on /_next/image across every page using Supabase-hosted photos — the
    // "images broken throughout the platform" reports). Serving the original
    // files directly is more reliable than an account-level quota we don't
    // control; the resize/format-conversion tradeoff is worth it.
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i.pravatar.cc',
      },
      {
        protocol: 'https',
        hostname: 'qcqnllehtuczgammazwi.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'bwtnzmevjlowwronylxm.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'framer-motion',
      'react-icons',
      '@radix-ui/react-slot',
    ],
  },
};

export default nextConfig;
