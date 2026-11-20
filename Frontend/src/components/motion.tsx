/**
 * Animations communes. Elles n'animent que la position, l'échelle et la
 * transparence, restent courtes et s'arrêtent si le système demande moins
 * d'animations (réglage `MotionConfig reducedMotion="user"` à la racine).
 */

import { motion, type Variants } from "motion/react";
import type { ReactNode } from "react";

export const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/** Apparition d'une page ou d'un bloc : fondu et léger glissement vers le haut. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE_OUT } },
};

/** Conteneur dont les enfants `fadeUp` apparaissent en cascade. */
export const cascade: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
};

interface RevealProps {
  children: ReactNode;
  className?: string;
  /** Fait apparaître les enfants `fadeUp` l'un après l'autre plutôt que le bloc entier. */
  stagger?: boolean;
}

/** Fait apparaître son contenu quand il entre dans l'écran, une seule fois. */
export function Reveal({ children, className, stagger = false }: RevealProps) {
  return (
    <motion.div
      className={className}
      variants={stagger ? cascade : fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
    >
      {children}
    </motion.div>
  );
}
