module.exports = {
  output: 'standalone',
  outputFileTracingRoot: require('path').join(__dirname),
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb'
    }
  },
  turbopack: {},
  webpack: (config) => {
    config.resolve.fallback = { fs: false, net: false, tls: false };
    return config;
  }
}