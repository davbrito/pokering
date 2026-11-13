import { defineConfig } from "@hey-api/openapi-ts";

// Pinned to a specific PokeAPI commit so generated types don't change unexpectedly.
const POKEAPI_SPEC_COMMIT = "8a92bfa7dab2f12b84b5d151562f9857c133ff30";

export default defineConfig({
  input: `https://raw.githubusercontent.com/PokeAPI/pokeapi/${POKEAPI_SPEC_COMMIT}/openapi.yml`,
  output: "src/api/pokeapi",
  plugins: ["@tanstack/react-query"],
});
