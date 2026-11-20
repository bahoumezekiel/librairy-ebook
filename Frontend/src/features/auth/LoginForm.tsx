import { zodResolver } from "@hookform/resolvers/zod";
import { Mail } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { ApiError } from "@/api/client";
import { Button } from "@/components/Button";

import { AuthField, FormError, PasswordField } from "./fields";
import { useLogin } from "./session";

const credentialsSchema = z.object({
  email: z.email("Saisissez une adresse e-mail valide."),
  password: z.string().min(1, "Saisissez votre mot de passe."),
});
type Credentials = z.infer<typeof credentialsSchema>;

function loginErrorMessage(error: Error) {
  if (!(error instanceof ApiError)) return "Connexion au serveur impossible. Réessayez.";
  if (error.status === 401) return "Adresse e-mail ou mot de passe incorrect.";
  return error.message;
}

/** Formulaire de connexion, commun à l'espace public et à l'administration. */
export function LoginForm() {
  const login = useLogin();
  const { register, handleSubmit, formState } = useForm<Credentials>({
    resolver: zodResolver(credentialsSchema),
  });
  const { errors } = formState;

  return (
    <form
      className="space-y-5"
      noValidate
      onSubmit={handleSubmit((credentials) => login.mutate(credentials))}
    >
      {login.isError && <FormError message={loginErrorMessage(login.error)} />}
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
        autoComplete="current-password"
        placeholder="Votre mot de passe"
        error={errors.password?.message}
        {...register("password")}
      />
      <Button type="submit" loading={login.isPending} className="h-12 w-full">
        Se connecter
      </Button>
    </form>
  );
}
