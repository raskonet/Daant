/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": require("path").resolve(__dirname, "src"),
    };

    // This is the crucial part:
    // If the build is for the server, tell Webpack to not try to resolve 'canvas'.
    // Instead, it will use a 'false' value, effectively making it an empty module.
    if (isServer) {
      config.externals = [...config.externals, "canvas"]; // Add 'canvas' to externals for server build
    }
    // Alternatively, you could mock it with an empty module,
    // but adding to externals is often simpler for this specific case.
    // if (isServer) {
    //   if (!config.resolve.fallback) {
    //     config.resolve.fallback = {};
    //   }
    //   config.resolve.fallback.canvas = false; // or require.resolve('./empty-mock') if you create an empty JS file
    // }

    return config;
  },

  rewrites: async () => {
    return [
      {
        source: "/api/v1/:path*",
        destination:
          process.env.NODE_ENV === "development"
            ? "http://localhost:8001/api/v1/:path*"
            : "/api/v1/:path*",
      },
    ];
  },
};

module.exports = nextConfig;
