/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  agentRules: false,
  transpilePackages: ['@mui/x-charts', '@mui/x-internals'],
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  output: 'export',
};

export default nextConfig;
