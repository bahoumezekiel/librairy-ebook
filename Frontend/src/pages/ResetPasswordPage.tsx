import { zodResolver } from "@hookform/resolvers/zod";
import { CircleCheck, LinkIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { Link, useParams } from "react-router";
import { z } from "zod";

import { Button, BUTTON_BASE, VARIANTS } from "@/components/Button";
import { Logo } from "@/components/Logo";
import { FormError, PasswordField } from "@/features/auth/fields";
import {
  linkRefused,
  passwordProblem,
  useConfirmPasswordReset,
} from "@/features/auth/passwordReset";

const MIN_LENGTH = 8;

const passwordSchema = z
  .object({
    password: z.string().min(MIN_LENGTH, `Au moins ${MIN_LENGTH} caractères.`),
    confirmation: z.string(),
  })
  .refine(({ password, confirmation }) => password === confirmation, {
    path: ["confirmation"],
    message: "Les deux mots de passe ne correspondent pas.",
  });
type NewPassword = z.infer<typeof passwordSchema>;

/** Carte centrée : cette page s'ouvre depuis un e-mail, hors du cadre de connexion. */
function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center bg-canvas px-4 py-10">
      <main className="w-full max-w-lg bg-white p-8 shadow-lift sm:p-10">
        <Link to="/" className="mb-8 inline-block" aria-label="FasoLib, accueil">
          <Logo className="text-3xl" />
        </Link>
        {children}
      </main>
    </div>
  );
}

/**
 * Choix d'un nouveau mot de passe, à l'arrivée du lien reçu par e-mail.
 *
 * Volontairement hors d'`AuthLayout` : celui-ci renvoie ailleurs tout utilisateur déjà
 * connecté, ce qui empêcherait de changer son mot de passe depuis un appareil connecté.
 */
export function ResetPasswordPage() {
  const { uid = "", token = "" } = useParams();
  const confirm = useConfirmPasswordReset();
  const { register, handleSubmit, formState } = useForm<NewPassword>({
    resolver: zodResolver(passwordSchema),
  });
  const { errors } = formState;

  if (confirm.isSuccess) {
    return (
      <Card>
        <CircleCheck className="mb-4 size-10 text-brand" aria-hidden />
        <h1 className="text-3xl font-bold">Mot de passe modifié</h1>
        <p className="mb-8 mt-2 text-sm text-muted">
          Vous pouvez dès maintenant vous connecter avec votre nouveau mot de passe.
        </p>
        <Link to="/connexion" className={`${BUTTON_BASE} ${VARIANTS.primary} h-12 w-full`}>
          Se connecter
        </Link>
      </Card>
    );
  }

  // Lien périmé, déjà utilisé ou modifié : rien à corriger dans le formulaire,
  // il faut en redemander un. Les autres erreurs restent affichées au-dessus des champs.
  if (linkRefused(confirm.error)) {
    return (
      <Card>
        <LinkIcon className="mb-4 size-10 text-danger" aria-hidden />
        <h1 className="text-3xl font-bold">Ce lien n'est plus valable</h1>
        <p className="mb-8 mt-2 text-sm text-muted">
          Un lien est valable une heure et ne sert qu'une fois. Demandez-en un nouveau pour
          choisir votre mot de passe.
        </p>
        <Link
          to="/mot-de-passe-oublie"
          className={`${BUTTON_BASE} ${VARIANTS.primary} h-12 w-full`}
        >
          Demander un nouveau lien
        </Link>
      </Card>
    );
  }

  return (
    <Card>
      <h1 className="text-3xl font-bold">Nouveau mot de passe</h1>
      <p className="mb-8 mt-2 text-sm text-muted">
        Choisissez un mot de passe que vous n'utilisez pas ailleurs.
      </p>
      <form
        className="space-y-5"
        noValidate
        onSubmit={handleSubmit(({ password }) => confirm.mutate({ uid, token, password }))}
      >
        {confirm.isError && <FormError message={passwordProblem(confirm.error)} />}
        <PasswordField
          id="password"
          label="Nouveau mot de passe"
          autoComplete="new-password"
          placeholder="Au moins 8 caractères"
          error={errors.password?.message}
          {...register("password")}
        />
        <PasswordField
          id="confirmation"
          label="Confirmer le mot de passe"
          autoComplete="new-password"
          placeholder="Le même mot de passe"
          error={errors.confirmation?.message}
          {...register("confirmation")}
        />
        <Button type="submit" loading={confirm.isPending} className="h-12 w-full">
          Enregistrer
        </Button>
      </form>
    </Card>
  );
}
