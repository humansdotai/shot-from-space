/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // three-globe ships ESM that Next handles fine; nothing special needed.
    return config;
  },
};

module.exports = nextConfig;
