import { motion } from "motion/react";

export interface Projectile {
  id: number;
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  moveType: string;
}

function getProjectileStyle(moveType: string) {
  let bg = "#ffffff",
    shadow = "0 0 15px #ffffff";
  if (["fire"].includes(moveType)) {
    bg = "#ff4500";
    shadow = "0 0 20px #ff0000, 0 0 40px #ff4500";
  } else if (["water", "ice"].includes(moveType)) {
    bg = "#00bfff";
    shadow = "0 0 20px #1e90ff, 0 0 40px #00bfff";
  } else if (["electric"].includes(moveType)) {
    bg = "#ffd700";
    shadow = "0 0 20px #ffff00, 0 0 40px #ffd700";
  } else if (["grass", "bug"].includes(moveType)) {
    bg = "#32cd32";
    shadow = "0 0 20px #00ff00, 0 0 40px #32cd32";
  } else if (["ghost", "dark", "poison", "psychic"].includes(moveType)) {
    bg = "#8a2be2";
    shadow = "0 0 20px #9400d3, 0 0 40px #8a2be2";
  }
  return { background: bg, boxShadow: shadow };
}

interface ProjectileFxProps {
  proj: Projectile;
  playbackSpeed: number;
}

export function ProjectileFx({ proj, playbackSpeed }: ProjectileFxProps) {
  const style = getProjectileStyle(proj.moveType);
  return (
    <motion.div
      className="fx-projectile"
      style={style}
      initial={{
        left: proj.sx,
        top: proj.sy,
        x: "-50%",
        y: "-50%",
        scale: 1.6,
      }}
      animate={{
        left: proj.tx,
        top: proj.ty,
        x: "-50%",
        y: "-50%",
        scale: 1.6,
      }}
      transition={{
        duration: 0.38 / playbackSpeed,
        ease: [0.25, 1, 0.5, 1],
      }}
    />
  );
}
