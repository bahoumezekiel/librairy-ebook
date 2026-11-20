/**
 * Illustration du bandeau d'accueil : des engrenages qui tournent au-dessus d'un livre ouvert,
 * entourés de livres qui flottent. Tout est dessiné en SVG et en HTML, sans image.
 *
 * Seules la rotation et la translation sont animées (accélérées par le navigateur),
 * et toutes les animations s'arrêtent si le système demande moins de mouvement.
 */

import { motion } from "motion/react";

const NAVY = "#0b1b3a";
const NAVY_RAISED = "#1d3566";
const ORANGE = "#ff7f00";

// --- Engrenages -------------------------------------------------------------------
// Les trois roues ont le même pas de denture : elles s'engrènent réellement.

/** Longueur d'une dent et de son creux, mesurée le long du cercle primitif. */
const TOOTH_PITCH = (2 * Math.PI * 139) / 20;
const TOOTH_DEPTH = 22;
/** Durée d'un tour de la grande roue ; les petites tournent plus vite, en sens inverse. */
const BIG_TURN_SECONDS = 40;

/** Contour d'une roue dentée centrée en (0, 0) : chaque dent est un trapèze. */
function gearPath(teeth: number, outer: number, root: number) {
  const step = (2 * Math.PI) / teeth;
  const point = (radius: number, angle: number) =>
    `${(radius * Math.cos(angle)).toFixed(2)},${(radius * Math.sin(angle)).toFixed(2)}`;
  const points = Array.from({ length: teeth }, (_, index) => {
    const start = index * step;
    return [
      point(root, start),
      point(outer, start + step * 0.18),
      point(outer, start + step * 0.42),
      point(root, start + step * 0.6),
    ];
  }).flat();
  return `M${points.join("L")}Z`;
}

interface Gear {
  teeth: number;
  /** Centre dans le repère 600 × 600 du dessin. */
  x: number;
  y: number;
  /** Angle de départ, en degrés, qui met les dents en prise avec la grande roue. */
  phase: number;
  /** 1 : sens des aiguilles d'une montre, -1 : sens inverse. */
  direction: 1 | -1;
}

const pitchRadius = (teeth: number) => (teeth * TOOTH_PITCH) / (2 * Math.PI);

/**
 * Place une roue contre la grande roue, dans la direction `angle` (en degrés).
 * Un creux de la petite roue fait face à une dent de la grande roue.
 */
function meshedGear(teeth: number, angle: number, big: Gear): Gear {
  const distance = pitchRadius(big.teeth) + pitchRadius(teeth);
  const radians = (angle * Math.PI) / 180;
  return {
    teeth,
    x: big.x + distance * Math.cos(radians),
    y: big.y + distance * Math.sin(radians),
    // Milieu d'un creux à 80 % du pas (voir gearPath), tourné vers la grande roue.
    phase: angle + 180 - (360 / teeth) * 0.8,
    direction: -1,
  };
}

const BIG_TEETH = 20;
const CONTACT_ANGLES = [-40, 140]; // espacés d'un multiple du pas : une dent fait face à chacune
const BIG: Gear = {
  teeth: BIG_TEETH,
  x: 300,
  y: 262,
  // Une dent de la grande roue (centrée à 30 % du pas) fait face à la première petite roue.
  phase: CONTACT_ANGLES[0] - (360 / BIG_TEETH) * 0.3,
  direction: 1,
};
const SMALL = meshedGear(10, CONTACT_ANGLES[0], BIG);
const TINY = meshedGear(8, CONTACT_ANGLES[1], BIG);

const shape = (teeth: number) => {
  const pitch = pitchRadius(teeth);
  return gearPath(teeth, pitch + TOOTH_DEPTH / 2, pitch - TOOTH_DEPTH / 2);
};

/** Roue qui tourne sans fin autour de son centre, à une vitesse liée à son nombre de dents. */
function Spinning({ gear, children }: { gear: Gear; children: React.ReactNode }) {
  return (
    <g transform={`translate(${gear.x} ${gear.y})`}>
      <motion.g
        initial={{ rotate: gear.phase }}
        animate={{ rotate: gear.phase + 360 * gear.direction }}
        transition={{
          duration: (BIG_TURN_SECONDS * gear.teeth) / BIG_TEETH,
          repeat: Infinity,
          ease: "linear",
        }}
      >
        {children}
      </motion.g>
    </g>
  );
}

/** Trous répartis sur une couronne : ils rendent la rotation lisible. */
function Holes({ count, radius, size, color }: { count: number; radius: number; size: number; color: string }) {
  return Array.from({ length: count }, (_, index) => {
    const angle = (index * 2 * Math.PI) / count;
    return <circle key={index} cx={radius * Math.cos(angle)} cy={radius * Math.sin(angle)} r={size} fill={color} />;
  });
}

// --- Livres -----------------------------------------------------------------------

const BOOK_TONES = {
  orange: { cover: "linear-gradient(150deg, #ffa040, #e06a00)", ink: NAVY, label: NAVY },
  navy: { cover: `linear-gradient(150deg, #27447f, ${NAVY})`, ink: "#ffffff", label: ORANGE },
  white: { cover: "linear-gradient(150deg, #ffffff, #dfe5ef)", ink: NAVY, label: ORANGE },
};

interface FloatingBook {
  tone: keyof typeof BOOK_TONES;
  /** Position et largeur, en pourcentage du cadre carré. */
  left: string;
  top: string;
  width: string;
  rotate: number;
  /** Amplitude et durée du flottement. */
  drift: number;
  duration: number;
  delay: number;
}

/** Livres derrière les engrenages (petits, plus pâles) puis devant (plus grands, plus nets). */
const BACK_BOOKS: FloatingBook[] = [
  { tone: "white", left: "8%", top: "2%", width: "17%", rotate: -16, drift: 10, duration: 7, delay: 0.5 },
  { tone: "navy", left: "60%", top: "62%", width: "15%", rotate: 14, drift: 8, duration: 8, delay: 0.8 },
];
const FRONT_BOOKS: FloatingBook[] = [
  { tone: "orange", left: "0%", top: "28%", width: "21%", rotate: -9, drift: 14, duration: 6, delay: 0.3 },
  { tone: "white", left: "79%", top: "46%", width: "20%", rotate: 11, drift: 12, duration: 6.5, delay: 0.6 },
];

/** Livre fermé stylisé : dos plus sombre, tranche de pages, bandeau et lignes de titre. */
function Book({ book, faded = false }: { book: FloatingBook; faded?: boolean }) {
  const { cover, ink, label } = BOOK_TONES[book.tone];
  return (
    <motion.div
      className="absolute"
      style={{ left: book.left, top: book.top, width: book.width }}
      initial={{ opacity: 0, y: 40, rotate: 0 }}
      animate={{ opacity: faded ? 0.75 : 1, y: 0, rotate: book.rotate }}
      transition={{ type: "spring", stiffness: 60, damping: 14, delay: book.delay }}
    >
      <motion.div
        className="relative aspect-3/4 shadow-[0_24px_48px_-12px_rgb(0_0_0/0.55)]"
        style={{ background: cover }}
        animate={{ y: [0, -book.drift, 0] }}
        transition={{ duration: book.duration, repeat: Infinity, ease: "easeInOut", delay: book.delay }}
      >
        {/* Tranche des pages, visible sur le côté droit. */}
        <span
          className="absolute -right-[5%] bottom-[3%] top-[3%] w-[5%]"
          style={{ background: "repeating-linear-gradient(90deg, #f4f6fa 0 2px, #c9d1de 2px 3px)" }}
        />
        {/* Dos du livre. */}
        <span className="absolute inset-y-0 left-0 w-[13%] bg-black/25" />
        <span className="absolute left-[24%] top-[12%] h-[7%] w-[36%]" style={{ background: label }} />
        <span className="absolute left-[24%] top-[30%] h-[5%] w-[56%] opacity-90" style={{ background: ink }} />
        <span className="absolute left-[24%] top-[39%] h-[5%] w-[42%] opacity-60" style={{ background: ink }} />
        <span className="absolute bottom-[12%] left-[24%] h-[3%] w-[30%] opacity-40" style={{ background: ink }} />
        {/* Reflet de lumière sur la couverture. */}
        <span className="absolute inset-0 bg-linear-to-br from-white/25 via-transparent to-transparent" />
      </motion.div>
    </motion.div>
  );
}

// --- Particules de savoir ---------------------------------------------------------

/** Points lumineux qui s'élèvent du livre ouvert vers les engrenages. */
const PARTICLES = [
  { x: 250, size: 4, delay: 0, duration: 4.5, color: ORANGE },
  { x: 282, size: 3, delay: 1.4, duration: 5, color: "#ffffff" },
  { x: 312, size: 5, delay: 0.7, duration: 4, color: ORANGE },
  { x: 345, size: 3, delay: 2.2, duration: 5.5, color: "#ffffff" },
  { x: 225, size: 3, delay: 3, duration: 4.8, color: "#ffffff" },
  { x: 368, size: 4, delay: 1.9, duration: 4.2, color: ORANGE },
];

/** Lignes de texte d'une page du livre ouvert, qui suivent la courbure du papier. */
const pageLines = (side: 1 | -1) =>
  [0, 1, 2, 3].map((line) => {
    const y = 486 + line * 16;
    const near = 300 - side * 22;
    const far = 300 - side * 150;
    return `M${near},${y + 4} Q${(near + far) / 2},${y - 10} ${far},${y}`;
  });

export function GearIllustration() {
  return (
    <motion.div
      className="relative mx-auto aspect-square w-full max-w-md lg:max-w-xl"
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
      aria-hidden
    >
      {/* Halo orange derrière la grande roue. */}
      <div className="absolute left-1/2 top-[44%] size-[62%] -translate-1/2 rounded-full bg-brand/25 blur-3xl" />

      {BACK_BOOKS.map((book) => (
        <Book key={book.left} book={book} faded />
      ))}

      <svg viewBox="0 0 600 600" className="absolute inset-0 size-full overflow-visible">
        <defs>
          <linearGradient id="gear-orange" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffa040" />
            <stop offset="1" stopColor="#e06a00" />
          </linearGradient>
          <linearGradient id="gear-white" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="1" stopColor="#cfd8e6" />
          </linearGradient>
          <linearGradient id="page" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="1" stopColor="#dde3ee" />
          </linearGradient>
          <radialGradient id="ground-shadow">
            <stop offset="0" stopColor="#000" stopOpacity="0.45" />
            <stop offset="1" stopColor="#000" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Ombre portée au sol, sous le livre ouvert. */}
        <ellipse cx="300" cy="582" rx="210" ry="22" fill="url(#ground-shadow)" />

        {/* Épaisseur des roues : une copie sombre décalée vers le bas, qui tourne en même temps. */}
        <g transform="translate(0 9)" opacity="0.55">
          {[BIG, SMALL, TINY].map((gear) => (
            <Spinning key={gear.teeth} gear={gear}>
              <path d={shape(gear.teeth)} fill="#000" stroke="#000" strokeWidth="5" strokeLinejoin="round" />
            </Spinning>
          ))}
        </g>

        <Spinning gear={TINY}>
          <path d={shape(TINY.teeth)} fill={NAVY_RAISED} stroke="#3a5592" strokeWidth="4" strokeLinejoin="round" />
          <Holes count={4} radius={26} size={7} color={NAVY} />
          <circle r="13" fill={ORANGE} />
        </Spinning>

        <Spinning gear={SMALL}>
          <path d={shape(SMALL.teeth)} fill="url(#gear-white)" stroke="#cfd8e6" strokeWidth="4" strokeLinejoin="round" />
          <circle r="44" fill="none" stroke={NAVY} strokeOpacity="0.12" strokeWidth="3" />
          <Holes count={5} radius={32} size={8} color={NAVY} />
          <circle r="15" fill={ORANGE} />
        </Spinning>

        <Spinning gear={BIG}>
          <path d={shape(BIG.teeth)} fill="url(#gear-orange)" stroke="#f07400" strokeWidth="5" strokeLinejoin="round" />
          <circle r="104" fill="none" stroke={NAVY} strokeOpacity="0.25" strokeWidth="4" />
          <Holes count={6} radius={74} size={17} color={NAVY} />
        </Spinning>

        {/* Moyeu fixe de la grande roue, marqué d'un livre ouvert : la technique au service de la lecture. */}
        <g transform={`translate(${BIG.x} ${BIG.y})`}>
          <circle r="40" fill="#ffffff" />
          <circle r="40" fill="none" stroke={NAVY} strokeOpacity="0.1" strokeWidth="6" />
          <path
            d="M0,-6 C-7,-12 -16,-13 -22,-11 L-22,13 C-16,11 -7,12 0,18 C7,12 16,11 22,13 L22,-11 C16,-13 7,-12 0,-6 Z M0,-6 L0,18"
            fill="none"
            stroke={NAVY}
            strokeWidth="4.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </g>

        {/* Livre ouvert d'où s'élève le savoir. */}
        <path d="M300,476 C240,452 170,452 112,470 L112,574 C170,556 240,556 300,580 C360,556 430,556 488,574 L488,470 C430,452 360,452 300,476 Z" fill={ORANGE} />
        <path d="M300,466 C246,444 182,444 128,460 L128,560 C182,544 246,544 300,566 Z" fill="url(#page)" />
        <path d="M300,466 C354,444 418,444 472,460 L472,560 C418,544 354,544 300,566 Z" fill="url(#page)" />
        <path d="M300,466 L300,566" stroke="#b9c3d4" strokeWidth="2" />
        {[...pageLines(1), ...pageLines(-1)].map((line) => (
          <path key={line} d={line} fill="none" stroke={NAVY} strokeOpacity="0.18" strokeWidth="5" strokeLinecap="round" />
        ))}

        {PARTICLES.map(({ x, size, delay, duration, color }) => (
          <motion.circle
            key={x}
            cx={x}
            cy={470}
            r={size}
            fill={color}
            initial={{ opacity: 0, y: 0 }}
            animate={{ opacity: [0, 1, 0], y: -150 }}
            transition={{ duration, delay, repeat: Infinity, ease: "easeOut" }}
          />
        ))}
      </svg>

      {FRONT_BOOKS.map((book) => (
        <Book key={book.left} book={book} />
      ))}
    </motion.div>
  );
}
