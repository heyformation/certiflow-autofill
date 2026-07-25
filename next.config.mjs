/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['xlsx', 'pizzip', 'docxtemplater', 'jszip', 'pdfkit', 'pg'],
  outputFileTracingIncludes: {
    '/api/**/*': ['./Templates/**/*', './node_modules/pdfkit/js/data/**/*'],
  },
};

export default nextConfig;
