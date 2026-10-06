import { withPayload } from "@payloadcms/next/withPayload";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Let a phone on the same Wi-Fi load dev scripts when opening the site by the Mac's LAN IP.
  allowedDevOrigins: ["10.*.*.*", "192.168.*.*", "172.*.*.*", "*.local"],
  images: {
    // Fine-line artwork smears at the default quality of 75.
    qualities: [75, 90],
  },
  // No X-Powered-By header (withPayload would otherwise send "Next.js, Payload").
  poweredByHeader: false,
  experimental: {
    // The site and the admin have separate root layouts, so unknown URLs get app/global-not-found.tsx.
    globalNotFound: true,
    // Hostinger's build box won't let Turbopack's spawned node workers connect back over
    // 127.0.0.1, so PostCSS (Tailwind) dies on globals.css. Worker threads stay in-process.
    turbopackPluginRuntimeStrategy: "workerThreads",
  },
};

const config = withPayload(nextConfig, { devBundleServerPackages: false });

// Payload asks for the colour-scheme client hint so the admin can theme its first paint. Only the admin
// needs it; on the public site the critical hint makes Chromium load a first visit twice.
export default {
  ...config,
  headers: async () =>
    ((await config.headers?.()) ?? []).map((rule) =>
      rule.source === "/:path*" ? { ...rule, source: "/admin/:path*" } : rule,
    ),
} satisfies NextConfig;
