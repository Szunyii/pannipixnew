import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Let a phone on the same Wi-Fi load dev scripts when opening the site by the Mac's LAN IP.
  allowedDevOrigins: ["10.*.*.*", "192.168.*.*", "172.*.*.*", "*.local"],
  images: {
    // Fine-line artwork smears at the default quality of 75.
    qualities: [75, 90],
  },
};

export default nextConfig;
