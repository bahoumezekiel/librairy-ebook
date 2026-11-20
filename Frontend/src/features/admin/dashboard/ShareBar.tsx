import { motion } from "motion/react";

export interface Share {
  key: string;
  value: number;
  /** Classe de couleur de fond du segment. */
  color: string;
}

/** Barre segmentée : la largeur de chaque segment est proportionnelle à sa valeur. */
export function ShareBar({ shares }: { shares: Share[] }) {
  const visible = shares.filter((share) => share.value > 0);
  return (
    <motion.div
      className="flex h-2.5 origin-left gap-0.5 overflow-hidden rounded-full bg-canvas"
      initial={{ scaleX: 0 }}
      animate={{ scaleX: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      aria-hidden
    >
      {visible.map((share) => (
        <span key={share.key} className={share.color} style={{ flexGrow: share.value }} />
      ))}
    </motion.div>
  );
}
