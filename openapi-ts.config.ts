import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
  input: "https://raw.githubusercontent.com/PokeAPI/pokeapi/refs/heads/master/openapi.yml",
  output: "src/api/pokeapi",
  plugins: ["@tanstack/react-query"],
});
