/** @type {import('next').NepackageaaxtConfig} */
const nextConfig = {
  // Tell Next.js to look in frontend/src for the app
  experimental: {
    externalDir: true,
  },

  // Configure webpack to resolve from frontend
  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": require("path").resolve(__dirname, "frontend/src"),
    };
    return config;
  },

  rewrites: async () => {
    return [
      {
        source: "/api/v1/:path*",
        destination: "/api/:path*",
      },
    ];
  },
};

module.exports = nextConfig;
