import type { MetadataRoute } from "next";

// Lets Safari/Chrome install KAUAI as a standalone app (Safari: File → Add to Dock),
// so it runs in its own window instead of a browser tab.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kaufmann AI",
    short_name: "KAUAI",
    description: "Clinical Cognition Engine",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0f172a",
    icons: [
      { src: "/app-icon.png", sizes: "512x512", type: "image/png" },
      { src: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
