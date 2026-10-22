import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, LogIn, Mail, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import "@lovable.dev/cloud-auth-js/styles.css";
import logoUrl from "@/assets/madeprimer_logo.png";

type AuthSearch = { redirect?: string };

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): AuthSearch => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Entrar — MadePrimer CRM" },
      { name: "description", content: "Acesso da equipe comercial ao CRM de prospecção MadePrimer." },
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
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: safeRedirect(redirect), replace: true });
    });
  }, [navigate, redirect]);

  const afterAuth = () => navigate({ to: safeRedirect(redirect), replace: true });

  const submitEmail = async () => {
    if (!email.includes("@")) { toast.error("Informe um e-mail válido."); return; }
    if (password.length < 6) { toast.error("A senha precisa de pelo menos 6 caracteres."); return; }
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) { toast.error("E-mail ou senha incorretos."); return; }
        afterAuth();
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) { toast.error(error.message); return; }
        if (!data.session) {
          setCheckEmail(true);
        } else {
          afterAuth();
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const signInGoogle = async () => {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) { toast.error("Não foi possível entrar com Google."); return; }
    if (result.redirected) return;
    afterAuth();
  };

  const signInLovable = async () => {
    const result = await lovable.auth.signInWithOAuth("lovable", { redirect_uri: window.location.origin });
    if (result.error) { toast.error("Não foi possível entrar com Lovable."); return; }
    if (result.redirected) return;
    afterAuth();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-header px-4">
      <div className="w-full max-w-md rounded-2xl border border-primary/30 bg-card p-8 shadow-2xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <img src={logoUrl} alt="MadePrimer — Planejados de Interiores" className="mb-4 h-16 w-auto rounded-lg bg-header p-2" width={1152} height={576} />
          <h1 className="text-xl font-bold tracking-tight">CRM Comercial</h1>
          <p className="mt-1 text-sm text-muted-foreground">Prospecção de escritórios de arquitetura</p>
        </div>

        {checkEmail ? (
          <div className="rounded-xl border border-success/30 bg-success/10 p-4 text-center">
            <Mail className="mx-auto mb-2 h-8 w-8 text-success" aria-hidden />
            <h2 className="font-semibold">Confirme seu e-mail</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Enviamos um link de confirmação para <b>{email}</b>. Clique nele e depois volte para entrar.
            </p>
            <Button variant="outline" className="mt-4" onClick={() => { setCheckEmail(false); setMode("signin"); }}>
              Voltar para o login
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <div>
                <label htmlFor="email" className="mb-1 block text-xs font-semibold text-muted-foreground">E-mail</label>
                <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@madeprimer.com.br" />
              </div>
              <div>
                <label htmlFor="password" className="mb-1 block text-xs font-semibold text-muted-foreground">Senha</label>
                <Input id="password" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" onKeyDown={(e) => e.key === "Enter" && submitEmail()} />
              </div>
              <Button className="w-full" onClick={submitEmail} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "signin" ? <LogIn className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                {mode === "signin" ? "Entrar" : "Criar conta"}
              </Button>
            </div>

            <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> ou <span className="h-px flex-1 bg-border" />
            </div>

            <div className="space-y-2">
              <Button variant="outline" className="w-full" onClick={signInGoogle}>
                Continuar com Google
              </Button>
              <button type="button" className="lovable-auth-button w-full" onClick={signInLovable}>
                Continuar com Lovable
              </button>
            </div>

            <p className="mt-4 text-center text-sm text-muted-foreground">
              {mode === "signin" ? "Ainda não tem conta?" : "Já tem conta?"}{" "}
              <button type="button" className="font-semibold text-primary underline-offset-2 hover:underline" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
                {mode === "signin" ? "Criar conta" : "Entrar"}
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
