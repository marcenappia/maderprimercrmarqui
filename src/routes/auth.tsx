import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, LogIn } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import logoUrl from "@/assets/madeprimer_logo.png";

type AuthSearch = { redirect?: string };
const AUTHORIZED_EMAIL = "madeprimermarketing@gmail.com";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): AuthSearch => {
    const r = search["redirect"];
    return typeof r === "string" ? { redirect: r } : {};
  },
  head: () => ({
    meta: [
      { title: "Entrar — MadePrimer CRM" },
      { name: "description", content: "Acesso restrito ao CRM comercial MadePrimer." },
    ],
  }),
  component: AuthPage,
});

function safeRedirect(value: string | undefined): string {
  if (value && value.startsWith("/") && !value.startsWith("//")) return value;
  return "/";
}

function AuthPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [email, setEmail] = useState(AUTHORIZED_EMAIL);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    Promise.resolve()
      .then(() => supabase.auth.getUser())
      .then(async ({ data, error }) => {
        if (error) {
          console.error("[Auth] Could not restore session:", error);
          return;
        }
        if (!mounted || !data.user) return;
        if (data.user.email?.toLowerCase() !== AUTHORIZED_EMAIL) {
          await supabase.auth.signOut();
          if (mounted) toast.error("Esta conta não tem autorização para acessar o CRM.");
          return;
        }
        navigate({ to: safeRedirect(redirect), replace: true });
      })
      .catch((error: unknown) => {
        console.error("[Auth] Session restore failed:", error);
        if (mounted) toast.error("Serviço de autenticação indisponível. Tente novamente.");
      });
    return () => { mounted = false; };
  }, [navigate, redirect]);

  const submitEmail = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (normalizedEmail !== AUTHORIZED_EMAIL) {
      toast.error("Acesso restrito à conta autorizada da MadePrimer.");
      return;
    }
    if (!password) {
      toast.error("Informe sua senha.");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: AUTHORIZED_EMAIL,
        password,
      });
      if (error) {
        console.error("[Auth] Sign-in rejected:", error.message);
        toast.error("Não foi possível entrar. Confira a senha ou solicite a redefinição ao administrador.");
        return;
      }
      if (data.user?.email?.toLowerCase() !== AUTHORIZED_EMAIL) {
        await supabase.auth.signOut();
        toast.error("Esta conta não tem autorização para acessar o CRM.");
        return;
      }
      navigate({ to: safeRedirect(redirect), replace: true });
    } catch (error) {
      console.error("[Auth] Sign-in request failed:", error);
      toast.error("Não foi possível conectar ao serviço de autenticação. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-header px-4">
      <div className="w-full max-w-md rounded-2xl border border-primary/30 bg-card p-8 shadow-2xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <img src={logoUrl} alt="MadePrimer — Planejados de Interiores" className="mb-4 h-16 w-auto rounded-lg bg-header p-2" width={1152} height={576} />
          <h1 className="text-xl font-bold tracking-tight">CRM Comercial</h1>
          <p className="mt-1 text-sm text-muted-foreground">Acesso restrito à conta autorizada</p>
        </div>
        <div className="space-y-3">
          <div>
            <label htmlFor="email" className="mb-1 block text-xs font-semibold text-muted-foreground">E-mail autorizado</label>
            <Input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitEmail()} />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-xs font-semibold text-muted-foreground">Senha</label>
            <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Sua senha" onKeyDown={(e) => e.key === "Enter" && submitEmail()} />
          </div>
          <Button className="w-full" onClick={submitEmail} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
            Entrar
          </Button>
        </div>
      </div>
    </div>
  );
}
