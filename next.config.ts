import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
