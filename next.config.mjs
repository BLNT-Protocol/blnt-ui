/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  agentRules: false,
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  output: 'export',
};

export default nextConfig;
