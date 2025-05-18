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
          index: "./src/index.js",
        },
      },
    },
  ],
  output: {
    target: "web",
  },
  plugins: [pluginNodePolyfill()],
});
