import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    // Shows the address lookup on the home page only when the server can run it
    // (the Civic API, or web search through the AI provider).
    NEXT_PUBLIC_ADDRESS_LOOKUP:
      process.env.GOOGLE_CIVIC_API_KEY || process.env.ANTHROPIC_API_KEY || process.env.GROQ_API_KEY || process.env.MOCK_AI === "1"
        ? "1"
        : "",
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
