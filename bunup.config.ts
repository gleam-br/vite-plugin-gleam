import { defineConfig } from "bunup";
import { exports, unused } from 'bunup/plugins';

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  target: "node",
  sourcemap: "linked",
  plugins: [exports(), unused()]
});
