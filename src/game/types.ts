export interface PokemonListItem {
  name: string;
  id: number;
}

export interface PokemonTypeInfo {
  type: { name: string };
}

export interface PokemonStat {
  base_stat: number;
  stat: { name: string };
}

export interface PokemonSprite {
  front_default: string | null;
  other?: {
    "official-artwork"?: {
      front_default: string | null;
    };
  };
}

export interface PokemonStats {
  hp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
}

export interface MoveResult {
  name: string;
  type: string;
  category: "physical" | "special";
  power: number;
  eff: number;
}

export interface BattleStep {
  type: "start" | "action" | "faint" | "end";
  text: string;
  attackerIdx?: number;
  moveName?: string;
  moveType?: string;
  category?: "physical" | "special";
  damage?: number;
  isCrit?: boolean;
  eff?: number;
  preHp?: [number, number];
  postHp?: [number, number];
  faintedIdx?: number;
  winnerIdx?: number;
}

export interface TypeData {
  pokemon: Array<{ pokemon: { name: string; url: string } }>;
}
