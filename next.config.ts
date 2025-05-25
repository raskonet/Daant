/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    tsconfigPath: "./frontend/tsconfig.json",
  },
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    config.resolve.plugins = [...(config.resolve.plugins || [])];
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": require("path").resolve(__dirname, "frontend/src"), // Manually define @ alias
    };
    return config;
  },
};

export default nextConfig;
