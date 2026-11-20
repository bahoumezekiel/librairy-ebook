import { ArrowRight } from "lucide-react";
import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { Link } from "react-router";

import { BUTTON_BASE, VARIANTS } from "@/components/Button";
import { EASE_OUT } from "@/components/motion";

import { GearIllustration } from "./GearIllustration";

const HEADLINE = ["Le", "savoir", "technique,"];
const ACCENT = ["à", "portée", "de", "main."];

/** Bleu nuit uni, à peine éclairci vers le bord gauche, derrière la photo. */
const BACKDROP = "bg-[linear-gradient(90deg,#1a3063_0%,#122650_28%,#0b1b3a_58%)]";

/**
 * Fondu de la photo vers la droite et vers le bas : elle se perd dans le bleu
 * sans arête visible. Les deux masques se combinent.
 */
const PHOTO_FADE = {
  maskImage:
    "linear-gradient(to right, black 55%, transparent), linear-gradient(to bottom, black 70%, transparent)",
  maskComposite: "intersect",
} as const;

/** Mot du titre qui monte depuis sa ligne, l'un après l'autre. */
function Word({ text, index, accent = false }: { text: string; index: number; accent?: boolean }) {
  return (
    <span className="inline-block overflow-hidden pb-2 align-bottom">
      <motion.span
        className={`inline-block ${accent ? "text-brand" : ""}`}
        initial={{ y: "110%" }}
        animate={{ y: 0 }}
        transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.1 + index * 0.07 }}
      >
        {text}&nbsp;
      </motion.span>
    </span>
  );
}

/** Bandeau d'accueil : photo et texte à gauche, illustration animée à droite, sur bleu nuit. */
export function Hero() {
  const section = useRef<HTMLElement>(null);
  // L'illustration monte un peu plus vite que la page quand on fait défiler.
  const { scrollYProgress } = useScroll({ target: section, offset: ["start start", "end start"] });
  const illustrationShift = useTransform(scrollYProgress, [0, 1], [0, -90]);

  return (
    <section ref={section} className={`relative overflow-hidden text-white ${BACKDROP}`}>
      {/*
        Photo collée au bord gauche, sur toute la hauteur du bandeau (sur téléphone : celle du texte).
        Le texte s'écrit par-dessus.
      */}
      <motion.div
        className="pointer-events-none absolute left-0 top-0 h-160 lg:-top-8 lg:h-[calc(100%+2rem)]"
        initial={{ opacity: 0, x: -40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 1, ease: EASE_OUT, delay: 0.15 }}
        aria-hidden
      >
        {/* Sur téléphone, le texte occupe toute la largeur : la photo y est plus discrète. */}
        <img
          src="/plan-detoure.webp"
          alt=""
          width={736}
          height={920}
          className="h-full w-auto max-w-none select-none opacity-45 lg:opacity-90"
          style={PHOTO_FADE}
        />
      </motion.div>

      {/* Halo orange qui dérive lentement derrière l'illustration. */}
      <motion.div
        className="absolute -right-40 top-1/4 size-136 rounded-full bg-brand/15 blur-3xl"
        animate={{ x: [0, -50, 0], y: [0, 40, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden
      />

      <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pb-16 pt-14 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
        {/* Ombre portée légère : garde le texte net quand il passe sur la photo. */}
        {/* Décalé vers le bas sur grand écran : le texte commence sous le visage de la photo. */}
        <div className="[text-shadow:0_2px_18px_rgb(11_27_58/0.55)] lg:translate-y-12">
          <motion.p
            className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-ink/50 px-4 py-2 text-sm font-bold backdrop-blur [text-shadow:none]"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="size-2 bg-brand" aria-hidden />
            La librairie des métiers du numérique
          </motion.p>

          <h1 className="mt-6 text-[2.6rem] font-bold leading-[1.05] sm:text-6xl">
            {HEADLINE.map((word, index) => (
              <Word key={word} text={word} index={index} />
            ))}
            <br />
            {ACCENT.map((word, index) => (
              <Word key={word} text={word} index={HEADLINE.length + index} accent />
            ))}
          </h1>

          <motion.p
            className="mt-6 max-w-xl text-lg text-white/85"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
          >
            Data science, analyse de données, cybersécurité, développement backend : des livres
            clairs et pratiques, à lire sur votre téléphone, même sans connexion.
          </motion.p>

          <motion.div
            className="mt-9 flex flex-wrap gap-3 [text-shadow:none]"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.85 }}
          >
            <Link to="/catalogue" className={`group ${BUTTON_BASE} ${VARIANTS.primary} h-13 px-7 text-base`}>
              Explorer le catalogue
              <ArrowRight
                className="size-5 transition-transform duration-200 group-hover:translate-x-1"
                aria-hidden
              />
            </Link>
            <Link
              to="/catalogue?type=gratuit"
              className={`${BUTTON_BASE} ${VARIANTS.onDark} h-13 px-7 text-base backdrop-blur`}
            >
              Voir les livres gratuits
            </Link>
          </motion.div>
        </div>

        <motion.div style={{ y: illustrationShift }}>
          <GearIllustration />
        </motion.div>
      </div>
    </section>
  );
}
