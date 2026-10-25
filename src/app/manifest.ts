import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ballot Helper",
    short_name: "Ballot Helper",
    description: "Nonpartisan research on every candidate and measure on your sample ballot.",
    start_url: "/",
    display: "standalone",
    background_color: "#08090a",
    theme_color: "#08090a",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
