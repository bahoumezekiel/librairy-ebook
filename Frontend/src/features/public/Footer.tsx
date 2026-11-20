import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { ArrowUp } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router";
import { z } from "zod";

import { api } from "@/api/client";
import { applyApiErrors } from "@/components/Field";
import { Logo } from "@/components/Logo";
import { Modal } from "@/components/Modal";
import { Reveal } from "@/components/motion";
import { useToast } from "@/components/Toast";
import { useSession } from "@/features/auth/session";

import { ContactForm } from "./ContactForm";
import { FIELD_ON_DARK, SQUARE_BUTTON } from "./forms";

const EYEBROW = "text-xs font-bold uppercase tracking-[0.2em] text-brand";
const COLUMN_LINK = "text-sm text-white/75 transition-colors duration-150 hover:text-white";

const newsletterSchema = z.object({ email: z.email("Saisissez une adresse e-mail valide.") });

/** Inscription à la newsletter, sur une seule ligne. */
function NewsletterForm() {
  const toast = useToast();
  const { register, handleSubmit, setError, reset, formState } = useForm<{ email: string }>({
    resolver: zodResolver(newsletterSchema),
  });
  const subscribe = useMutation({
    mutationFn: (values: { email: string }) => api("/newsletter/", { method: "POST", body: values }),
  });

  const submit = handleSubmit((values) =>
    subscribe.mutate(values, {
      onSuccess: () => reset(),
      onError: (error) => toast("error", applyApiErrors(error, setError)),
    }),
  );

  return (
    <AnimatePresence mode="wait">
      {subscribe.isSuccess ? (
        <motion.p
          key="done"
          className="border border-leaf/40 bg-leaf/10 px-5 py-4 text-sm font-bold text-white"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          role="status"
        >
          Merci ! Votre adresse est bien inscrite à la newsletter.
        </motion.p>
      ) : (
        <motion.form key="form" noValidate onSubmit={submit} exit={{ opacity: 0 }}>
          <div className="flex flex-col gap-3 sm:flex-row">
            <label htmlFor="newsletter-email" className="sr-only">
              Adresse e-mail
            </label>
            <input
              id="newsletter-email"
              type="email"
              autoComplete="email"
              placeholder="votre@email.com"
              className={FIELD_ON_DARK}
              aria-invalid={Boolean(formState.errors.email)}
              {...register("email")}
            />
            <button type="submit" disabled={subscribe.isPending} className={`${SQUARE_BUTTON} shrink-0`}>
              {subscribe.isPending ? "Inscription…" : "S'inscrire"}
            </button>
          </div>
          {formState.errors.email && (
            <p className="mt-2 text-sm text-[#ff8a80]">{formState.errors.email.message}</p>
          )}
        </motion.form>
      )}
    </AnimatePresence>
  );
}

/**
 * Pied de page : appel au contact, newsletter, colonnes de liens et mentions.
 * Le formulaire de contact s'ouvre dans une fenêtre depuis « Contactez-nous ».
 */
export function Footer() {
  const { data: user } = useSession();
  const [contactOpen, setContactOpen] = useState(false);
  const openContact = () => setContactOpen(true);

  const columns = [
    {
      title: "Explorer",
      links: [
        { label: "Accueil", to: "/" },
        { label: "Catalogue", to: "/catalogue" },
        { label: "Livres gratuits", to: "/catalogue?type=gratuit" },
        { label: "Les mieux notés", to: "/catalogue?tri=rating" },
      ],
    },
    {
      title: "Mon compte",
      links: user
        ? [{ label: "Ma bibliothèque", to: "/bibliotheque" }]
        : [
            { label: "Connexion", to: "/connexion" },
            { label: "Créer un compte", to: "/inscription" },
          ],
    },
  ];

  return (
    <footer className="text-white">
      <section className="bg-ink">
        <Reveal className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-20 sm:px-8 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-3xl font-bold sm:text-4xl">Une question ? Parlons-en.</h2>
            <p className="mt-3 text-white/70">
              Un livre, un paiement, une collaboration : nous répondons à chaque message.
            </p>
          </div>
          <button type="button" onClick={openContact} className={`${SQUARE_BUTTON} shrink-0 px-10`}>
            Contactez-nous
          </button>
        </Reveal>
      </section>

      <section className="bg-ink-raised">
        <Reveal className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:px-8 lg:grid-cols-2">
          <div>
            <p className={EYEBROW}>Newsletter</p>
            <h2 className="mt-3 max-w-lg text-2xl font-bold leading-snug sm:text-3xl">
              Chaque nouveau livre, dès sa publication, dans votre boîte e-mail.
            </h2>
          </div>
          <NewsletterForm />
        </Reveal>
      </section>

      <section className="bg-ink">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Logo onDark />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/65">
              Des livres techniques en data, cybersécurité et développement backend, à lire même
              sans connexion.
            </p>
          </div>
          {columns.map(({ title, links }) => (
            <nav key={title} aria-label={title}>
              <p className={EYEBROW}>{title}</p>
              <ul className="mt-5 space-y-3">
                {links.map(({ label, to }) => (
                  <li key={to}>
                    <Link to={to} className={COLUMN_LINK}>
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
          <div>
            <p className={EYEBROW}>Contact</p>
            <ul className="mt-5 space-y-3">
              <li>
                <button type="button" onClick={openContact} className={COLUMN_LINK}>
                  Nous écrire
                </button>
              </li>
              <li className="text-sm text-white/75">Réponse par e-mail</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-6 sm:px-8">
            <p className="text-xs text-white/55">© {new Date().getFullYear()} FasoLib. Tous droits réservés.</p>
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              aria-label="Revenir en haut de la page"
              title="Revenir en haut de la page"
              className="grid size-11 place-items-center border border-white/20 text-white transition-colors duration-150 hover:border-brand hover:bg-brand hover:text-ink"
            >
              <ArrowUp className="size-5" aria-hidden />
            </button>
          </div>
        </div>
      </section>

      <Modal open={contactOpen} onClose={() => setContactOpen(false)} title="Nous contacter" size="lg" square>
        <ContactForm onDone={() => setContactOpen(false)} />
      </Modal>
    </footer>
  );
}
