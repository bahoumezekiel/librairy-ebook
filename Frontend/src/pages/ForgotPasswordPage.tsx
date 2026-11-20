import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck, Mail as MailIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { Link } from "react-router";
import { z } from "zod";

import { errorMessage } from "@/api/client";
import { Button } from "@/components/Button";
import { AuthField, FormError } from "@/features/auth/fields";
import { useRequestPasswordReset } from "@/features/auth/passwordReset";

const requestSchema = z.object({ email: z.email("Saisissez une adresse e-mail valide.") });
type Request = z.infer<typeof requestSchema>;

/** Demande d'un lien de réinitialisation (cadre : `AuthLayout`). */
export function ForgotPasswordPage() {
  const request = useRequestPasswordReset();
  const { register, handleSubmit, formState } = useForm<Request>({
    resolver: zodResolver(requestSchema),
  });

  // L'API répond de la même façon pour une adresse inscrite ou non : l'écran de
  // confirmation ne dit donc pas si un compte existe, seulement ce qui a été tenté.
  if (request.isSuccess) {
    return (
      <>
        <MailCheck className="mb-4 size-10 text-brand" aria-hidden />
        <h1 className="text-3xl font-bold">Vérifiez votre boîte e-mail</h1>
        <p className="mb-8 mt-2 text-sm text-muted">
          Si un compte existe avec l'adresse <strong className="text-ink">{request.variables}</strong>,
          un lien vient d'y être envoyé. Il est valable une heure et ne sert qu'une fois.
        </p>
        <Link to="/connexion" className="text-sm font-bold text-brand hover:underline">
          Revenir à la connexion
        </Link>
      </>
    );
  }

  return (
    <>
      <h1 className="text-3xl font-bold">Mot de passe oublié</h1>
      <p className="mb-8 mt-2 text-sm text-muted">
        Indiquez l'adresse de votre compte : nous vous enverrons un lien pour choisir un
        nouveau mot de passe.
      </p>
      <form
        className="space-y-5"
        noValidate
        onSubmit={handleSubmit(({ email }) => request.mutate(email))}
      >
        {request.isError && <FormError message={errorMessage(request.error)} />}
        <AuthField
          id="email"
          label="Adresse e-mail"
          icon={MailIcon}
          type="email"
          autoComplete="email"
          placeholder="vous@exemple.com"
          error={formState.errors.email?.message}
          {...register("email")}
        />
        <Button type="submit" loading={request.isPending} className="h-12 w-full">
          Envoyer le lien
        </Button>
      </form>
    </>
  );
}
