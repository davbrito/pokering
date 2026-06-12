<div align="center">
  <h1>
    Poke<em>Ring</em>
  </h1>
  <p>
    <strong>Simulador de batallas Pokémon</strong>
  </p>
  <p>
    Elige dos Pokémon, analiza sus estadísticas y descubre quién dominaría el campo de batalla.
  </p>
</div>

## 🧩 Descripción

**PokeRing** es una aplicación web interactiva que simula combates Pokémon. Selecciona dos luchadores de entre todos los Pokémon disponibles, explora sus estadísticas detalladas y tipos, y ejecuta una simulación por turnos que calcula daño basado en estadísticas reales, efectividad de tipos y movimientos obtenidos directamente de la [PokeAPI](https://pokeapi.co/).

La batalla se reproduce paso a paso con animaciones, barras de vida dinámicas y un registro visual de cada acción.

## ✨ Características

- **Selección de Pokémon** — Navega y filtra por nombre y tipo. Cada Pokémon muestra sus estadísticas base (HP, Ataque, Defensa, At. Esp., Def. Esp., Velocidad) y su sprite oficial.
- **Simulación por turnos** — El motor de combate calcula daño usando estadísticas reales, tabla de tipos, movimientos con poder y categoría (físico/especial), y factor crítico aleatorio.
- **Reproducción animada** — La batalla se reproduce turno por turno con animaciones fluidas, barras de vida que se actualizan en tiempo real y velocidades de reproducción ajustables.
- **Resultados claros** — Al finalizar se muestra un resumen del combate con el ganador, los movimientos usados y el daño infligido.

## 🛠️ Stack tecnológico

| Tecnología | Propósito |
|---|---|
| [React 19](https://react.dev/) | UI declarativa y reactiva |
| [TypeScript](https://www.typescriptlang.org/) | Tipado estático |
| [TanStack React Router](https://tanstack.com/router) | Enrutamiento con soporte SSR |
| [TanStack React Query](https://tanstack.com/query) | Fetching y caché de datos |
| [Zustand](https://github.com/pmndrs/zustand) | Estado global liviano |
| [Tailwind CSS v4](https://tailwindcss.com/) | Estilos utilitarios |
| [Motion](https://motion.dev/) | Animaciones declarativas |
| [Base UI React](https://base-ui.com/) | Componentes de UI accesibles |
| [Vite](https://vitejs.dev/) | Bundler y dev server |
| [Cloudflare Workers](https://workers.cloudflare.com/) | Despliegue serverless |
| [Biome](https://biomejs.dev/) | Formateo y linting |
| [PokeAPI](https://pokeapi.co/) | Datos de Pokémon y movimientos |

## 📁 Estructura del proyecto

```
src/
├── api/                # Cliente generado de PokeAPI
│   └── pokeapi/
├── game/               # Lógica del simulador
│   ├── api.ts          # Utilidades de sprites
│   ├── combat.ts       # Motor de combate (daño, movimientos, efectividad)
│   ├── data.ts         # Tabla de tipos, constantes y datos estáticos
│   ├── store.tsx       # Estado global (Zustand)
│   ├── types.ts        # Tipos del simulador
│   └── components/     # Componentes de la UI del juego
│       ├── BattleResult.tsx
│       ├── BattleStage.tsx
│       ├── GameLoading.tsx
│       ├── PokemonModal.tsx
│       ├── PokemonSlot.tsx
│       └── renderStepContent.tsx
├── routes/             # Rutas (file-based routing)
│   ├── __root.tsx      # Layout raíz
│   └── index.tsx       # Página principal (simulador)
├── style/
│   └── game.css        # Estilos del simulador
├── styles.css          # Entry point de estilos globales
└── router.tsx          # Configuración del router
```

## 🚀 Primeros pasos

```bash
# Instalar dependencias
pnpm install

# Iniciar en modo desarrollo
pnpm dev
```

La aplicación estará disponible en `http://localhost:3000`.

## 📦 Build y despliegue

```bash
# Build de producción
pnpm build

# Desplegar en Cloudflare Workers
pnpm deploy
```

## 🧪 Testing

```bash
pnpm test
```

## 📐 Formateo y linting

```bash
# Formatear código
pnpm format

# Lint
pnpm lint

# Verificar todo
pnpm check
```

## ⚙️ Configuración

- **TypeScript** — Configuración estricta en `tsconfig.json`.
- **Vite** — Plugin de Cloudflare y Tailwind en `vite.config.ts`.
- **Wrangler** — Configuración de despliegue en `wrangler.jsonc`.
- **Biome** — Formateo y linting en `biome.json`.

## 📄 Licencia

**GNU General Public License v3.0** — Consulta el archivo [LICENSE](./LICENSE) para más detalles.