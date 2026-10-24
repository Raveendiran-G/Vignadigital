/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [{ source: '/kitchen-dashboard', destination: '/kitchen', permanent: false }];
  },
};
export default nextConfig;
