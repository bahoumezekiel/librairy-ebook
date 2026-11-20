import { zodResolver } from "@hookform/resolvers/zod";
import { Mail, UserRound } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/Button";
import { applyApiErrors } from "@/components/Field";
import { AuthField, FormError, PasswordField } from "@/features/auth/fields";
import { useRegister } from "@/features/auth/session";

const name = (message: string) => z.string().trim().min(1, message).max(150);

const accountSchema = z.object({
  first_name: name("Saisissez votre prénom."),
  last_name: name("Saisissez votre nom."),
  email: z.email("Saisissez une adresse e-mail valide."),
  password: z.string().min(8, "8 caractères au minimum."),
});
type Account = z.infer<typeof accountSchema>;

/** Onglet « Inscription » de l'espace public (cadre : `AuthLayout`). */
export function RegisterPage() {
  const signUp = useRegister();
  const { register, handleSubmit, setError, formState } = useForm<Account>({
    resolver: zodResolver(accountSchema),
  });
  const { errors } = formState;

  return (
    <>
      <h1 className="text-3xl font-bold">Créez votre compte</h1>
      <p className="mb-8 mt-2 text-sm text-muted">
        Gratuit, en moins d'une minute. Aucun moyen de paiement n'est demandé.
      </p>
      <form
        className="space-y-5"
        noValidate
        onSubmit={handleSubmit((account) =>
          // Les erreurs de l'API (e-mail déjà pris, mot de passe trop simple) vont sous leur champ.
          signUp.mutate(account, { onError: (error) => applyApiErrors(error, setError) }),
        )}
      >
        {signUp.isError && !Object.keys(errors).length && (
          <FormError message="La création du compte a échoué. Réessayez." />
        )}
        <div className="grid gap-5 sm:grid-cols-2">
          <AuthField
            id="first_name"
            label="Prénom"
            icon={UserRound}
            autoComplete="given-name"
            error={errors.first_name?.message}
            {...register("first_name")}
          />
          <AuthField
            id="last_name"
            label="Nom"
            icon={UserRound}
            autoComplete="family-name"
            error={errors.last_name?.message}
            {...register("last_name")}
          />
        </div>
        <AuthField
          id="email"
          label="Adresse e-mail"
          icon={Mail}
          type="email"
          autoComplete="email"
          placeholder="vous@exemple.com"
          error={errors.email?.message}
          {...register("email")}
        />
        <PasswordField
          id="password"
          label="Mot de passe"
          autoComplete="new-password"
          placeholder="8 caractères au minimum"
          error={errors.password?.message}
          {...register("password")}
        />
        <Button type="submit" loading={signUp.isPending} className="h-12 w-full">
          Créer mon compte
        </Button>
      </form>
    </>
  );
}
