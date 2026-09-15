/** @type {import('next').NextConfig} */
const { i18n } = require('./next-i18next.config');

if (
  process.env.NODE_ENV === 'production' &&
  !process.env.NEXT_PUBLIC_SERVER_API
) {
  throw new Error('NEXT_PUBLIC_SERVER_API environment variable is required for production builds.');
}

const nextConfig = {
  i18n,
  distDir: process.env.GENERALS_NEXT_DIST_DIR || '.next',
  reactStrictMode: false,
  swcMinify: true,
  output: 'standalone',
};

module.exports = nextConfig;
