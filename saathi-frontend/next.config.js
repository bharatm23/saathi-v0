/** @type {import('next').NextConfig} */
const nextConfig = {
  // Your existing health dashboard runs on port 3000.
  // Saathi runs on port 3001.
  // The dashboard iframe at /dashboard proxies through here.
  async rewrites() {
    return []
  },
}

module.exports = nextConfig
