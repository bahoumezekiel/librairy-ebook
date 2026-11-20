import { Library, ShieldCheck, WifiOff } from "lucide-react";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { Link } from "react-router";

import { Logo } from "@/components/Logo";
import { cascade, fadeUp } from "@/components/motion";

const HIGHLIGHTS = [
  { icon: Library, title: "Livres techniques" },
  { icon: WifiOff, title: "Lecture hors ligne" },
  { icon: ShieldCheck, title: "Paiement sécurisé" },
];

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

/** Mise en page de la connexion à l'administration : photo à gauche, formulaire à droite. */
export function AuthShell({ title, subtitle, children }: AuthShellProps) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Sur téléphone, seule la colonne du formulaire est affichée. */}
      <aside className="relative hidden overflow-hidden bg-ink lg:block">
        <motion.img
          src="/etudiant.jpg"
          alt="Étudiante travaillant sur son ordinateur dans une bibliothèque"
          className="absolute inset-0 size-full object-cover object-top"
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
        {/* Dégradé sombre : garde le texte lisible quelle que soit la photo. */}
        <div className="absolute inset-0 bg-linear-to-t from-ink via-ink/50 to-transparent" aria-hidden />

        <motion.div
          className="absolute inset-x-0 bottom-0 p-12 text-white"
          variants={cascade}
          initial="hidden"
          animate="visible"
        >
          <motion.p variants={fadeUp} className="max-w-md text-4xl font-bold leading-tight">
            Le savoir technique, <span className="block text-brand">à portée de main.</span>
          </motion.p>
          <ul className="mt-8 flex flex-wrap gap-3">
            {HIGHLIGHTS.map(({ icon: Icon, title }) => (
              <motion.li
                key={title}
                variants={fadeUp}
                className="flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-bold backdrop-blur"
              >
                <Icon className="size-4" aria-hidden />
                {title}
              </motion.li>
            ))}
          </ul>
        </motion.div>
      </aside>

      <main className="flex items-center justify-center bg-white px-6 py-12">
        <motion.div className="w-full max-w-sm" variants={cascade} initial="hidden" animate="visible">
          <motion.div variants={fadeUp}>
            <Link to="/" className="inline-block rounded-lg" aria-label="Retour à l'accueil">
              <Logo className="text-3xl" />
            </Link>
            <h1 className="mt-10 text-2xl font-bold">{title}</h1>
            <p className="mt-2 text-sm text-muted">{subtitle}</p>
          </motion.div>
          <motion.div variants={fadeUp} className="mt-8">
            {children}
          </motion.div>
        </motion.div>
      </main>
    </div>
  );
}
