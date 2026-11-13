import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { paraglideVitePlugin } from "@inlang/paraglide-js";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        // Lógica pura (máquinas, combate): corre en el runtime de Workers.
        plugins: [cloudflareTest({ wrangler: { configPath: "./wrangler.jsonc" } })],
        test: { name: "logic", include: ["test/**/*.test.ts"] },
      },
      {
        // Los mensajes (`m.*`) los genera el plugin de Paraglide, igual que en `vite.config.ts`.
        plugins: [
          paraglideVitePlugin({
            project: "./project.inlang",
            outdir: "./src/i18n/paraglide",
            strategy: ["cookie", "preferredLanguage", "baseLocale"],
          }),
        ],
        // Componentes de React contra el estado de la máquina: necesitan DOM.
        test: {
          name: "ui",
          environment: "jsdom",
          include: ["test/**/*.test.tsx"],
          setupFiles: ["./test/ui/setup.ts"],
        },
      },
    ],
  },
});
