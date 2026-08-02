/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['xlsx', 'pizzip', 'docxtemplater', 'jszip', 'pdfkit', 'pg'],
  outputFileTracingIncludes: {
    '/api/**/*': ['./Templates/**/*', './Templates_MD/**/*', './node_modules/pdfkit/js/data/**/*'],
  },
};

export default nextConfig;
