import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Let a phone on the same Wi-Fi load dev scripts when opening the site by the Mac's LAN IP.
  allowedDevOrigins: ["10.*.*.*", "192.168.*.*", "172.*.*.*", "*.local"],
  images: {
    // Fine-line artwork smears at the default quality of 75.
    qualities: [75, 90],
  },
  experimental: {
    // Hostinger's build box won't let Turbopack's spawned node workers connect back over
    // 127.0.0.1, so PostCSS (Tailwind) dies on globals.css. Worker threads stay in-process.
    turbopackPluginRuntimeStrategy: "workerThreads",
  },
};

export default nextConfig;
