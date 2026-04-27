/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Keep pdfjs-dist out of the server bundle entirely.
      // It requires a browser worker thread and crashes RSC routes on import.
      config.externals = [
        ...(Array.isArray(config.externals)
          ? config.externals
          : [config.externals].filter(Boolean)),
        'pdfjs-dist',
        'pdfjs-dist/legacy/build/pdf',
      ];
    }

    config.resolve.alias.canvas = false;
    config.resolve.alias.encoding = false;
    return config;
  },
};

module.exports = nextConfig;
