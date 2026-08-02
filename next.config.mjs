/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb"
    }
  },
  async redirects() {
    return [
      {
        source: "/contests",
        destination: "/races",
        permanent: true,
      },
      {
        source: "/position-races",
        destination: "/races",
        permanent: true,
      },
      {
        source: "/my-contests",
        destination: "/dashboard",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
