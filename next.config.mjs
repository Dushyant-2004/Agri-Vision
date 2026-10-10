/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep hot-reload output isolated from production builds. Sharing `.next`
  // lets a concurrent `next start` invalidate development browser chunks.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next"
};

export default nextConfig;
