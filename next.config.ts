
import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  async rewrites() {
    let backendUrl = process.env.BACKEND_URL;
    if (!backendUrl || backendUrl.trim() === '') {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('BACKEND_URL environment variable is missing or empty in production build.');
      }
      console.warn('BACKEND_URL is not set. API rewrites may fail.');
      backendUrl = '';
    } else {
      backendUrl = backendUrl.trim();
      try {
        new URL(backendUrl);
      } catch (e) {
        throw new Error(`BACKEND_URL is malformed: ${backendUrl}`);
      }
      if (backendUrl.endsWith('/api') || backendUrl.endsWith('/api/')) {
        throw new Error('BACKEND_URL should not contain a trailing /api as the rewrite already adds it.');
      }
      if (process.env.NEXT_PUBLIC_APP_URL && backendUrl === process.env.NEXT_PUBLIC_APP_URL) {
        throw new Error('BACKEND_URL cannot point to the frontend itself.');
      }
    }
    
    // Normalize trailing slash
    backendUrl = backendUrl.replace(/\/+$/, '');

    return [
      {
        source: '/api/:path((?!auth(?:/|$)|employee(?:/|$)|employees(?:/|$)|performance(?:/|$)).*)',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
  async redirects() {
    return [
      {
        source: '/dashboard/admin/billing/:path*',
        destination: '/dashboard/accounts/billing/:path*',
        permanent: true,
      },
      {
        source: '/dashboard/admin/billing',
        destination: '/dashboard/accounts/billing',
        permanent: true,
      },
    ];
  },
  /* config options here */
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'date-fns', 'recharts'],
  },
  images: {
    dangerouslyAllowSVG: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'api.dicebear.com',
      },
    ],
  },

  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      handlebars: 'handlebars/dist/handlebars.js'
    };

    if (!isServer) {
      // Required to polyfill node modules used by html-to-docx
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        stream: false,
        util: false,
        http: false,
        https: false,
        url: false,
        punycode: false,
        zlib: false,
        os: false,
      };
    }

    return config;
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "frame-ancestors 'self' http://localhost:* https://*.google.com https://*.dbiz.online https://dbiz.online https://*.dbizoffice.com; frame-src 'self' http://localhost:* https://www.youtube.com https://www.youtube-nocookie.com https://*.google.com https://*.dbiz.online https://dbiz.online https://*.dbizoffice.com https://*.supabase.co blob: data:; media-src 'self' https://*.supabase.co blob: data:;",
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN', // Allows embedding from self, blocks others
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          }
        ],
      },
    ];
  },
};

export default nextConfig;





