/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['xlsx', 'pizzip', 'docxtemplater', 'jszip'],
  outputFileTracingIncludes: {
    '/api/**/*': ['./Templates/**/*'],
  },
};

export default nextConfig;
