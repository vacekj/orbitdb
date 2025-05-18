import { pluginNodePolyfill } from "@rsbuild/plugin-node-polyfill";
import { defineConfig } from "@rslib/core";

export default defineConfig({
  lib: [
    {
      dts: true,
      format: "esm",
      output: {
        distPath: {
          root: "./dist/esm",
        },
      },
      source: {
        entry: {
          index: "./src/index.ts",
        },
      },
    },
  ],
  output: {
    target: "web",
    sourceMap: true,
  },
  plugins: [pluginNodePolyfill()],
});
