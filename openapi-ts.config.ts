import { defineConfig } from "@hey-api/openapi-ts";

// Pinned to a specific PokeAPI commit so generated types don't change unexpectedly.
const POKEAPI_SPEC_COMMIT = "6ea97b5641faa12e090866e8144ae8f57764fc64";

export default defineConfig({
  input: `https://raw.githubusercontent.com/PokeAPI/pokeapi/${POKEAPI_SPEC_COMMIT}/openapi.yml`,
  output: "src/api/pokeapi",
  parser: {
    patch: {
      schemas: {
        // Workaround: the spec only declares `front_default` in PokemonSprites, but
        // the API also returns `other` (we only declare what the app uses).
        // See https://github.com/PokeAPI/pokeapi/issues/1710
        PokemonSprites: (schema) => {
          schema.properties = {
            ...schema.properties,
            other: {
              type: "object",
              properties: {
                "official-artwork": {
                  type: "object",
                  properties: { front_default: { type: ["string", "null"] } },
                },
              },
            },
          };
        },
      },
    },
  },
  plugins: ["@tanstack/react-query"],
});
