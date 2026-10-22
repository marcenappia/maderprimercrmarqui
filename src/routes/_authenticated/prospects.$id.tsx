import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, MessageSquareText, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { initialProspects, type Prospect } from "@/lib/prospects";
import logoUrl from "@/assets/madeprimer_logo.png";

export const Route = createFileRoute("/_authenticated/prospects/$id")({
  head: () => ({
    meta: [
      { title: "MadePrimer CRM — Histórico do Escritório" },
      { name: "description", content: "Histórico de mensagens e respostas trocadas com o escritório." },
    ],
  }),
  component: ProspectHistory,
});

type LeadRow = {
  id: number;
  name: string;
  focus: string;
  source: string;
  channel: string;
  phone: string;
  email: string;
  priority: string;
  notes: string;
};

type Interaction = {
  id: number;
  prospect_id: number;
  direction: "enviada" | "recebida";
  content: string;
  created_at: string;
};

const defaultLeadMessage = (name: string) =>
  `Olá, equipe ${name}! Sou o Evaldo, da MadePrimer, marcenaria de móveis planejados e sob medida. Trabalhamos em parceria com escritórios de arquitetura executando a marcenaria dos projetos com alto padrão de acabamento. Posso enviar nosso portfólio para vocês conhecerem nosso trabalho?`;

const leadToProspect = (l: LeadRow): Prospect => ({
  id: l.id,
  priority: (l.priority as Prospect["priority"]) || "P2",
  name: l.name,
  focus: l.focus,
  source: l.source,
  phoneFormatted: l.phone || l.email,
  phoneRaw: l.phone || l.email,
  channel: l.channel,
  status: "A Enviar",
  message: defaultLeadMessage(l.name),
  followUp: "",
});

function ProspectHistory() {
  const { id } = Route.useParams();
  const prospectId = Number(id);

  const [prospect, setProspect] = useState<Prospect | null>(
    () => initialProspects.find((p) => p.id === prospectId) ?? null,
  );
  const [loadingProspect, setLoadingProspect] = useState(prospect === null);
  const [items, setItems] = useState<Interaction[]>([]);
  const [direction, setDirection] = useState<"enviada" | "recebida">("enviada");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  // Se não está na lista fixa, busca nos leads cadastrados
  useEffect(() => {
    if (prospect !== null || !Number.isFinite(prospectId)) return;
    let active = true;
    supabase
      .from("prospects")
      .select("*")
      .eq("id", prospectId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        setLoadingProspect(false);
        if (error) {
          toast.error("Não foi possível carregar o escritório.");
          return;
        }
        if (data) setProspect(leadToProspect(data as LeadRow));
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prospectId]);

  // Carrega histórico e assina mudanças em tempo real
  useEffect(() => {
    if (!Number.isFinite(prospectId)) return;
    let active = true;
    supabase
      .from("prospect_interactions")
      .select("id, prospect_id, direction, content, created_at")
      .eq("prospect_id", prospectId)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          toast.error("Não foi possível carregar o histórico.");
          return;
        }
        setItems((data ?? []) as Interaction[]);
      });

    const channel = supabase
      .channel(`prospect_interactions_${prospectId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "prospect_interactions",
          filter: `prospect_id=eq.${prospectId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const row = payload.new as Interaction;
            setItems((prev) => (prev.some((i) => i.id === row.id) ? prev : [row, ...prev]));
          } else if (payload.eventType === "DELETE") {
            const old = payload.old as { id?: number };
            if (old.id != null) setItems((prev) => prev.filter((i) => i.id !== old.id));
          } else if (payload.eventType === "UPDATE") {
            const row = payload.new as Interaction;
            setItems((prev) => prev.map((i) => (i.id === row.id ? row : i)));
          }
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [prospectId]);

  const addInteraction = async () => {
    const text = content.trim();
    if (text.length < 2) {
      toast.error("Escreva a mensagem antes de registrar.");
      return;
    }
    if (text.length > 4000) {
      toast.error("Mensagem muito longa (máx. 4000 caracteres).");
      return;
    }
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("prospect_interactions").insert({
      prospect_id: prospectId,
      direction,
      content: text,
      created_by: userData.user?.id ?? null,
    });
    setSaving(false);
    if (error) {
      toast.error("Falha ao registrar no histórico.");
      return;
    }
    setContent("");
    toast.success(direction === "enviada" ? "Mensagem registrada." : "Resposta registrada.");
  };

  const removeInteraction = async (interactionId: number) => {
    if (!window.confirm("Remover este registro do histórico?")) return;
    const { error } = await supabase
      .from("prospect_interactions")
      .delete()
      .eq("id", interactionId);
    if (error) toast.error("Falha ao remover o registro.");
  };

  const sorted = useMemo(
    () => [...items].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
    [items],
  );

  if (!Number.isFinite(prospectId) || (!loadingProspect && prospect === null)) {
    throw notFound();
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-header text-header-foreground">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div className="flex items-center gap-3">
            <img src={logoUrl} alt="MadePrimer — Planejados de Interiores" className="h-11 w-auto" width={1152} height={576} />
            <div>
              <h1 className="text-lg font-bold leading-tight">
                {loadingProspect ? "Carregando…" : prospect?.name}
              </h1>
              <p className="text-xs text-header-muted">
                {prospect ? `${prospect.focus} · ${prospect.channel}` : "Histórico de conversas"}
              </p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm" className="border-header-foreground/30 bg-transparent text-header-foreground hover:bg-header-foreground/10 hover:text-header-foreground">
            <Link to="/"><ArrowLeft className="h-4 w-4" /> Voltar ao painel</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-6">
        <section className="rounded-xl border bg-card p-5">
          <h2 className="flex items-center gap-2 text-base font-bold">
            <MessageSquareText className="h-5 w-5 text-primary" /> Registrar no histórico
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Anote o que foi enviado e o que o escritório respondeu, para a equipe acompanhar.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-[180px_1fr]">
            <Select value={direction} onValueChange={(v) => setDirection(v as "enviada" | "recebida")}>
              <SelectTrigger aria-label="Tipo de registro">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="enviada">Mensagem enviada</SelectItem>
                <SelectItem value="recebida">Resposta recebida</SelectItem>
              </SelectContent>
            </Select>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              maxLength={4000}
              placeholder={direction === "enviada" ? "Ex.: Enviei o portfólio pelo WhatsApp…" : "Ex.: Pediram orçamento para um apartamento na Moema…"}
              aria-label="Conteúdo da mensagem"
            />
          </div>
          <div className="mt-3 flex justify-end">
            <Button onClick={addInteraction} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Registrar
            </Button>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border bg-card">
          <div className="border-b bg-muted/50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Histórico ({sorted.length})
          </div>
          {sorted.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              Nenhuma conversa registrada ainda. Registre a primeira acima.
            </p>
          ) : (
            <ul className="divide-y">
              {sorted.map((i) => (
                <li key={i.id} className="flex items-start gap-3 px-4 py-3">
                  <span
                    className={cn(
                      "mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full",
                      i.direction === "enviada" ? "bg-blue-500" : "bg-emerald-500",
                    )}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className={cn("font-semibold", i.direction === "enviada" ? "text-blue-700" : "text-emerald-700")}>
                        {i.direction === "enviada" ? "Mensagem enviada" : "Resposta recebida"}
                      </span>
                      <span>
                        {new Date(i.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                      </span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{i.content}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => removeInteraction(i.id)}
                    aria-label="Remover registro"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
