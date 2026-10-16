import { defineConfig } from "vitest/config";
import path from "path";
import { loadEnvLocalFiles } from "./src/lib/load-env-local";

loadEnvLocalFiles(path.resolve(__dirname));

export default defineConfig({
  esbuild: {
    jsx: "automatic",
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
