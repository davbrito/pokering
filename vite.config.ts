import { cloudflare } from "@cloudflare/vite-plugin";
import { heyApiPlugin } from "@hey-api/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tailwindcss(),
    tanstackStart(),
    react(),
    heyApiPlugin({
      config: {
        input:
          "https://raw.githubusercontent.com/PokeAPI/pokeapi/refs/heads/master/openapi.yml",
        output: "src/api/pokeapi",
        plugins: [{ name: "@tanstack/react-query" }],
      },
    }),
  ],
});
