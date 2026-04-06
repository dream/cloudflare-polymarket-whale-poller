import { defineConfig } from "vitest/config";
import { cloudflareTest, cloudflarePool } from "@cloudflare/vitest-pool-workers";

export default defineConfig({
  plugins: [
    cloudflareTest({
      main: "./src/index.ts",
      wrangler: { configPath: "./wrangler.toml" },
    }),
  ],
  test: {
    pool: cloudflarePool({
      main: "./src/index.ts",
      wrangler: { configPath: "./wrangler.toml" },
    }),
  },
});
