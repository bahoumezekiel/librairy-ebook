import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { api } from "@/api/client";
import { applyApiErrors } from "@/components/Field";
import { useToast } from "@/components/Toast";
import { useSession } from "@/features/auth/session";

import { FIELD, LabelledField, SQUARE_BUTTON } from "./forms";

/** Même limite que l'API. */
const MAX_MESSAGE_LENGTH = 5000;

const messageSchema = z.object({
  name: z.string().trim().min(1, "Saisissez votre nom.").max(150),
  email: z.email("Saisissez une adresse e-mail valide."),
  subject: z.string().trim().min(1, "Indiquez l'objet de votre message.").max(150),
  message: z
    .string()
    .trim()
    .min(10, "Votre message est un peu court (10 caractères au minimum).")
    .max(MAX_MESSAGE_LENGTH, `${MAX_MESSAGE_LENGTH} caractères au maximum.`),
});
type Message = z.infer<typeof messageSchema>;

/** Formulaire de contact, affiché dans une fenêtre ouverte depuis le pied de page. */
export function ContactForm({ onDone }: { onDone: () => void }) {
  const toast = useToast();
  const { data: user } = useSession();
  const { register, handleSubmit, setError, watch, formState } = useForm<Message>({
    resolver: zodResolver(messageSchema),
    // Un client connecté n'a pas à ressaisir son nom et son e-mail.
    defaultValues: user ? { name: `${user.first_name} ${user.last_name}`, email: user.email } : {},
  });
  const { errors } = formState;
  const send = useMutation({
    mutationFn: (message: Message) => api("/contact/", { method: "POST", body: message }),
  });
  const length = watch("message")?.length ?? 0;

  const submit = handleSubmit((message) =>
    send.mutate(message, { onError: (error) => toast("error", applyApiErrors(error, setError)) }),
  );

  return (
    <AnimatePresence mode="wait">
      {send.isSuccess ? (
        <motion.div
          key="sent"
          className="py-10 text-center"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <motion.span
            className="mx-auto grid size-16 place-items-center bg-leaf text-white"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 16 }}
            aria-hidden
          >
            <svg viewBox="0 0 24 24" className="size-8" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
              <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4, delay: 0.25 }} />
            </svg>
          </motion.span>
          <h3 className="mt-6 text-2xl font-bold">Message envoyé</h3>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
            Merci de nous avoir écrit. Nous vous répondrons à l'adresse e-mail indiquée.
          </p>
          <button type="button" onClick={onDone} className={`${SQUARE_BUTTON} mt-8`}>
            Fermer
          </button>
        </motion.div>
      ) : (
        <motion.form key="form" className="space-y-6" noValidate onSubmit={submit} exit={{ opacity: 0 }}>
          <p className="text-sm text-muted">
            Une question sur un livre, un souci de paiement, une proposition de collaboration :
            écrivez-nous, nous vous répondons par e-mail.
          </p>
          <div className="grid gap-6 sm:grid-cols-2">
            <LabelledField label="Nom complet" htmlFor="contact-name" error={errors.name?.message}>
              <input id="contact-name" autoComplete="name" placeholder="Prénom et nom" className={FIELD} aria-invalid={Boolean(errors.name)} {...register("name")} />
            </LabelledField>
            <LabelledField label="Adresse e-mail" htmlFor="contact-email" error={errors.email?.message}>
              <input id="contact-email" type="email" autoComplete="email" placeholder="vous@exemple.com" className={FIELD} aria-invalid={Boolean(errors.email)} {...register("email")} />
            </LabelledField>
          </div>
          <LabelledField label="Objet" htmlFor="contact-subject" error={errors.subject?.message}>
            <input id="contact-subject" placeholder="En quelques mots" className={FIELD} aria-invalid={Boolean(errors.subject)} {...register("subject")} />
          </LabelledField>
          <LabelledField
            label="Message"
            htmlFor="contact-message"
            error={errors.message?.message}
            aside={`${length} / ${MAX_MESSAGE_LENGTH}`}
          >
            <textarea
              id="contact-message"
              rows={6}
              maxLength={MAX_MESSAGE_LENGTH}
              placeholder="Votre message"
              className={`${FIELD} h-auto resize-y py-3`}
              aria-invalid={Boolean(errors.message)}
              {...register("message")}
            />
          </LabelledField>
          <div className="flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted">Votre adresse sert uniquement à vous répondre.</p>
            <button type="submit" disabled={send.isPending} className={SQUARE_BUTTON}>
              {send.isPending ? "Envoi en cours…" : "Envoyer le message"}
            </button>
          </div>
        </motion.form>
      )}
    </AnimatePresence>
  );
}
