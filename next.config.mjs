/** @type {import('next').NextConfig} */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "/agarwood";

const nextConfig = {
  basePath,
  trailingSlash: false
};

export default nextConfig;
