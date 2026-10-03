/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@helios/shared', '@helios/canonical-ast']
};

export default nextConfig;
