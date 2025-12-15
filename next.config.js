/** @type {import('next').NextConfig} */
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

module.exports = nextConfig;
