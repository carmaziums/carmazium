import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async rewrites() {
    return [
      {
        source: '/.well-known/apple-app-site-association',
        destination: '/api/app-association/apple',
      },
      {
        source: '/.well-known/assetlinks.json',
        destination: '/api/app-association/android',
      },
    ];
  },
  async redirects() {
    return [
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
