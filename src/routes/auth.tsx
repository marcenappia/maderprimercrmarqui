import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type AuthSearch = { redirect?: string };

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): AuthSearch => {
    const redirectTo = search["redirect"];
    return typeof redirectTo === "string" ? { redirect: redirectTo } : {};
  },
  head: () => ({
    meta: [
      { title: "Preparando acesso — MadePrimer CRM" },
      { name: "robots", content: "noindex, nofollow" },
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
  const [message, setMessage] = useState("Preparando seu acesso seguro…");
  const [retrying, setRetrying] = useState(false);

  const initialize = async () => {
    setRetrying(true);
    setMessage("Preparando seu acesso seguro…");
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      if (data.user) {
        await navigate({ to: safeRedirect(redirect), replace: true });
        return;
      }
      const { data: session, error: anonymousError } = await supabase.auth.signInAnonymously();
      if (anonymousError || !session.user) throw anonymousError ?? new Error("A sessão anônima não foi criada.");
      await navigate({ to: safeRedirect(redirect), replace: true });
    } catch (error) {
      console.error("[Auth] Anonymous access initialization failed:", error);
      setMessage("Não foi possível iniciar o acesso automático. É necessário habilitar a autenticação anônima no Supabase e configurar as variáveis do ambiente.");
    } finally {
      setRetrying(false);
    }
  };

  useEffect(() => { void initialize(); }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <section className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-xl">
        <h1 className="text-xl font-bold">MadePrimer CRM</h1>
        <p className="mt-3 text-sm text-muted-foreground">{message}</p>
        <Button className="mt-5" onClick={() => void initialize()} disabled={retrying}>
          {retrying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {retrying ? "Conectando…" : "Tentar novamente"}
        </Button>
      </section>
    </main>
  );
}
