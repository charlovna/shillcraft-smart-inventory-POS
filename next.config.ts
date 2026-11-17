import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  // TEMPORARY (Cloudflare Workers pivot, 2026-11-17): cacheComponents and
  // partialPrefetching make the OpenNext Worker hang on page requests (tested
  // locally and live). Re-enable when moving back to Vercel or once OpenNext
  // supports them. See CLAUDE.md "Temporary stack pivot".
  // cacheComponents: true,
  // partialPrefetching: true,
};

// Lets `npm run dev` use Cloudflare bindings (e.g. HYPERDRIVE). Dev only.
initOpenNextCloudflareForDev();

export default nextConfig;
