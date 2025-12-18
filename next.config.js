/** @type {import('next').NextConfig} */
const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
});

const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [
      "images.unsplash.com",
      "yvepuccjiaktluxcpadk.supabase.co",
    ],
  },
  experimental: {
    serverComponentsExternalPackages: ['pdfkit'],
  },
};

module.exports = withPWA(nextConfig);
