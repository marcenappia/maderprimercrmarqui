import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Copy,
  ExternalLink,
  History,
  Loader2,
  LogOut,
  MessageCircle,
  RotateCcw,
  Search,
  Send,
  Sparkles,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  followUpTemplate,
  initialProspects,
  type Priority,
  type Prospect,
  type Status,
} from "@/lib/prospects";
import { generateApproach, generateReply } from "@/lib/ai/message.functions";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import logoUrl from "@/assets/madeprimer_logo.png";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "MadePrimer CRM — Prospecção de Escritórios" },
      { name: "description", content: "Painel de prospecção de escritórios de arquitetura da marcenaria MadePrimer." },
    ],
  }),
  component: Index,
});

const STATUSES: { value: Status; label: string; dot: string; chip: string }[] = [
  { value: "A Enviar", label: "A Enviar", dot: "bg-slate-400", chip: "bg-slate-100 text-slate-700" },
  { value: "WhatsApp Aberto", label: "WhatsApp Aberto", dot: "bg-sky-500", chip: "bg-sky-100 text-sky-800" },
  { value: "Mensagem Enviada", label: "Mensagem Enviada", dot: "bg-blue-500", chip: "bg-blue-100 text-blue-800" },
  { value: "Em Conversa", label: "Em Conversa", dot: "bg-violet-500", chip: "bg-violet-100 text-violet-800" },
  { value: "Reunião Agendada", label: "Reunião Agendada", dot: "bg-emerald-500", chip: "bg-emerald-100 text-emerald-800" },
  { value: "Sem Interesse", label: "Sem Interesse", dot: "bg-rose-500", chip: "bg-rose-100 text-rose-800" },
];

const PRIORITY: Record<Priority, { label: string; className: string }> = {
  P1: { label: "P1", className: "bg-primary/15 text-accent-foreground border-primary/40" },
  P2: { label: "P2", className: "bg-amber-100 text-amber-800 border-amber-300" },
  P3: { label: "P3", className: "bg-slate-100 text-slate-600 border-slate-300" },
};

const isWhats = (p: Prospect) => p.channel === "WhatsApp";

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

const defaultLeadMessage = (name: string) =>
  `Olá, equipe ${name}! Sou o Evaldo, da MadePrimer, marcenaria de móveis planejados e sob medida. Trabalhamos em parceria com escritórios de arquitetura executando a marcenaria dos projetos com alto padrão de acabamento. Posso enviar nosso portfólio para vocês conhecerem nosso trabalho?`;

const leadToProspect = (l: LeadRow): Prospect => ({
  id: l.id,
  priority: (l.priority as Priority) || "P2",
  name: l.name,
  focus: l.focus,
  source: l.source,
  phoneFormatted: l.phone || l.email,
  phoneRaw: l.phone || l.email,
  channel: l.channel,
  status: "A Enviar",
  message: defaultLeadMessage(l.name),
  followUp: followUpTemplate,
});
const waUrl = (phone: string, msg: string) =>
  `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Mensagem copiada.");
  } catch {
    toast.error("Não foi possível copiar.");
  }
}

function Index() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [statuses, setStatuses] = useState<Record<number, Status>>({});
  const [dbProspects, setDbProspects] = useState<Prospect[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [fPriority, setFPriority] = useState<"all" | Priority>("all");
  const [fStatus, setFStatus] = useState<"all" | Status>("all");
  const [modal, setModal] = useState<Prospect | null>(null);
  const [draft, setDraft] = useState("");
  const [followUp, setFollowUp] = useState("");

  // Carrega status da nuvem e assina mudanças em tempo real
  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (active) setUserId(data.user?.id ?? null);
    });
    supabase
      .from("prospect_statuses")
      .select("prospect_id, status")
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          toast.error("Não foi possível carregar os status salvos.");
          return;
        }
        const map: Record<number, Status> = {};
        for (const row of data ?? []) map[row.prospect_id] = row.status as Status;
        setStatuses(map);
      });

    const channel = supabase
      .channel("prospect_statuses_sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "prospect_statuses" },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const old = payload.old as { prospect_id?: number };
            if (old.prospect_id != null) {
              setStatuses((prev) => {
                const next = { ...prev };
                delete next[old.prospect_id!];
                return next;
              });
            }
            return;
          }
          const row = payload.new as { prospect_id: number; status: string };
          setStatuses((prev) => ({ ...prev, [row.prospect_id]: row.status as Status }));
        },
      )
      .subscribe();

    supabase
      .from("prospects")
      .select("*")
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) toast.error("Não foi possível carregar os leads cadastrados.");
        setDbProspects(((data ?? []) as LeadRow[]).map(leadToProspect));
      });

    const leadsChannel = supabase
      .channel("prospects_list_sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "prospects" }, (payload) => {
        if (payload.eventType === "INSERT") {
          setDbProspects((prev) => [...prev, leadToProspect(payload.new as LeadRow)]);
        } else if (payload.eventType === "DELETE") {
          const old = payload.old as { id?: number };
          if (old.id != null) setDbProspects((prev) => prev.filter((p) => p.id !== old.id));
        } else if (payload.eventType === "UPDATE") {
          const row = leadToProspect(payload.new as LeadRow);
          setDbProspects((prev) => prev.map((p) => (p.id === row.id ? row : p)));
        }
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
      supabase.removeChannel(leadsChannel);
    };
  }, []);

  const allProspects = useMemo(
    () => [...initialProspects, ...dbProspects],
    [dbProspects],
  );

  const statusOf = (id: number): Status => statuses[id] ?? "A Enviar";

  const setStatus = (id: number, status: Status) => {
    setStatuses((prev) => ({ ...prev, [id]: status }));
    supabase
      .from("prospect_statuses")
      .upsert({ prospect_id: id, status, updated_by: userId, updated_at: new Date().toISOString() })
      .then(({ error }) => {
        if (error) toast.error("Falha ao sincronizar o status.");
      });
  };

  const resetAll = async () => {
    if (!window.confirm("Zerar o status de todos os contatos para toda a equipe?")) return;
    setStatuses({});
    const { error } = await supabase.from("prospect_statuses").delete().gte("prospect_id", 0);
    if (error) toast.error("Falha ao zerar os status.");
    else toast.success("Status zerados para toda a equipe.");
  };

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const counts = useMemo(() => {
    const total = allProspects.length;
    const sent = allProspects.filter((p) => statusOf(p.id) === "Mensagem Enviada").length;
    const pending = allProspects.filter((p) => {
      const s = statusOf(p.id);
      return s === "A Enviar" || s === "WhatsApp Aberto";
    }).length;
    return { total, sent, pending };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statuses, allProspects]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allProspects.filter((p) => {
      if (fPriority !== "all" && p.priority !== fPriority) return false;
      if (fStatus !== "all" && statusOf(p.id) !== fStatus) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.focus.toLowerCase().includes(q) ||
        p.source.toLowerCase().includes(q)
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, fPriority, fStatus, statuses, allProspects]);

  const openModal = (p: Prospect) => {
    setModal(p);
    setDraft(p.message);
    setFollowUp(followUpTemplate);
  };

  const openWhatsApp = (p: Prospect, msg: string) => {
    window.open(waUrl(p.phoneRaw, msg), "_blank", "noopener");
    if (statusOf(p.id) === "A Enviar") setStatus(p.id, "WhatsApp Aberto");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-header text-header-foreground">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div className="flex items-center gap-3">
            <img src={logoUrl} alt="MadePrimer — Planejados de Interiores" className="h-11 w-auto" width={1152} height={576} />
            <div>
              <h1 className="text-lg font-bold leading-tight">CRM Comercial</h1>
              <p className="text-xs text-header-muted">Prospecção de escritórios de arquitetura</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="border-header-foreground/30 bg-transparent text-header-foreground hover:bg-header-foreground/10 hover:text-header-foreground">
              <Link to="/leads"><UserPlus className="h-4 w-4" /> Leads</Link>
            </Button>
            <Button variant="outline" size="sm" onClick={resetAll} className="border-header-foreground/30 bg-transparent text-header-foreground hover:bg-header-foreground/10 hover:text-header-foreground">
              <RotateCcw className="h-4 w-4" /> Zerar status
            </Button>
            <Button variant="outline" size="sm" onClick={signOut} className="border-header-foreground/30 bg-transparent text-header-foreground hover:bg-header-foreground/10 hover:text-header-foreground">
              <LogOut className="h-4 w-4" /> Sair
            </Button>
          </div>
        </div>
        <div className="mx-auto grid max-w-6xl grid-cols-3 gap-3 px-4 pb-4">
          {[
            { label: "Total", value: counts.total },
            { label: "Enviados", value: counts.sent },
            { label: "Pendentes", value: counts.pending },
          ].map((c) => (
            <div key={c.label} className="rounded-xl bg-header-foreground/10 px-4 py-3 text-center">
              <div className="text-2xl font-extrabold">{c.value}</div>
              <div className="text-xs text-header-muted">{c.label}</div>
            </div>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <AiGenerator onSend={openWhatsApp} />
        <AiReply onSend={openWhatsApp} />

        <section className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-56 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar escritório, foco ou fonte…"
              className="pl-9"
              aria-label="Buscar escritório"
            />
          </div>
          <Select value={fPriority} onValueChange={(v) => setFPriority(v as "all" | Priority)}>
            <SelectTrigger className="w-40" aria-label="Filtrar por prioridade">
              <SelectValue placeholder="Prioridade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas prioridades</SelectItem>
              <SelectItem value="P1">P1 — Alta</SelectItem>
              <SelectItem value="P2">P2 — Média</SelectItem>
              <SelectItem value="P3">P3 — Baixa</SelectItem>
            </SelectContent>
          </Select>
          <Select value={fStatus} onValueChange={(v) => setFStatus(v as "all" | Status)}>
            <SelectTrigger className="w-48" aria-label="Filtrar por status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </section>

        <section className="overflow-hidden rounded-xl border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">Escritório</th>
                  <th className="px-4 py-3">Prioridade</th>
                  <th className="px-4 py-3">Canal</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const st = statusOf(p.id);
                  const stCfg = STATUSES.find((s) => s.value === st)!;
                  return (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="font-semibold">{p.name}</div>
                        <div className="text-xs text-muted-foreground">{p.focus} · {p.source}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("inline-block rounded-full border px-2 py-0.5 text-xs font-bold", PRIORITY[p.priority].className)}>
                          {PRIORITY[p.priority].label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs">{p.channel}</td>
                      <td className="px-4 py-3">
                        <Select value={st} onValueChange={(v) => setStatus(p.id, v as Status)}>
                          <SelectTrigger className={cn("h-8 w-44 text-xs", stCfg.chip)} aria-label={`Status de ${p.name}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUSES.map((s) => (
                              <SelectItem
                                key={s.value}
                                value={s.value}
                                disabled={s.value === "Mensagem Enviada" && st === "A Enviar"}
                              >
                                <span className="flex items-center gap-2">
                                  <span className={cn("h-2 w-2 rounded-full", s.dot)} />
                                  {s.label}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          {isWhats(p) ? (
                            <Button size="sm" onClick={() => openWhatsApp(p, p.message)}>
                              <MessageCircle className="h-4 w-4" /> 1º Contato
                            </Button>
                          ) : (
                            <Button size="sm" variant="secondary" onClick={() => openModal(p)}>
                              <Copy className="h-4 w-4" /> Ver 1º
                            </Button>
                          )}
                          {st === "WhatsApp Aberto" && (
                            <Button size="sm" variant="outline" onClick={() => setStatus(p.id, "Mensagem Enviada")}>
                              <Send className="h-4 w-4" /> Marcar enviada
                            </Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => openModal(p)}>
                            Mensagens
                          </Button>
                          <Button asChild size="sm" variant="outline" aria-label={`Histórico de ${p.name}`}>
                            <Link to="/prospects/$id" params={{ id: String(p.id) }}>
                              <History className="h-4 w-4" /> Histórico
                            </Link>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                      Nenhum escritório encontrado com esses filtros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <Dialog open={modal !== null} onOpenChange={(open) => !open && setModal(null)}>
        <DialogContent className="max-w-2xl">
          {modal && (
            <>
              <DialogHeader>
                <DialogTitle>{modal.name}</DialogTitle>
                <DialogDescription>{modal.focus} · {modal.channel}</DialogDescription>
              </DialogHeader>
              <Tabs defaultValue="first">
                <TabsList>
                  <TabsTrigger value="first">1º Contato</TabsTrigger>
                  <TabsTrigger value="followup">Follow-up</TabsTrigger>
                </TabsList>
                <TabsContent value="first" className="space-y-3">
                  <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={7} aria-label="Mensagem de primeiro contato" />
                  <DialogFooter className="gap-2 sm:gap-2">
                    <Button variant="outline" onClick={() => copy(draft)}>
                      <Copy className="h-4 w-4" /> Copiar
                    </Button>
                    {isWhats(modal) && (
                      <Button onClick={() => openWhatsApp(modal, draft)}>
                        <ExternalLink className="h-4 w-4" /> Disparar WhatsApp
                      </Button>
                    )}
                  </DialogFooter>
                </TabsContent>
                <TabsContent value="followup" className="space-y-3">
                  <Textarea value={followUp} onChange={(e) => setFollowUp(e.target.value)} rows={7} aria-label="Mensagem de follow-up" />
                  <DialogFooter className="gap-2 sm:gap-2">
                    <Button variant="outline" onClick={() => copy(followUp)}>
                      <Copy className="h-4 w-4" /> Copiar
                    </Button>
                    {isWhats(modal) && (
                      <Button onClick={() => { openWhatsApp(modal, followUp); setStatus(modal.id, "Em Conversa"); }}>
                        <ExternalLink className="h-4 w-4" /> Disparar WhatsApp
                      </Button>
                    )}
                  </DialogFooter>
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AiGenerator({ onSend }: { onSend: (p: Prospect, msg: string) => void }) {
  const [prospectId, setProspectId] = useState<string>("");
  const [context, setContext] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const idRef = useRef(0);

  const prospect = initialProspects.find((p) => String(p.id) === prospectId);

  const generate = async () => {
    if (!prospect) { toast.error("Selecione um escritório."); return; }
    if (context.trim().length < 3) { toast.error("Descreva o contexto do contato."); return; }
    const callId = ++idRef.current;
    setLoading(true);
    setResult("");
    try {
      const res = await generateApproach({ data: { prospectId: prospect.id, context: context.trim() } });
      if (callId !== idRef.current) return;
      if (res.error) toast.error(res.error);
      else setResult(res.message ?? "");
    } catch {
      if (callId === idRef.current) toast.error("Não foi possível gerar a mensagem agora.");
    } finally {
      if (callId === idRef.current) setLoading(false);
    }
  };

  return (
    <section className="rounded-xl border bg-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" aria-hidden />
        <div>
          <h2 className="font-bold">Gerar abordagem com IA</h2>
          <p className="text-xs text-muted-foreground">Mensagem de primeiro contato personalizada pelo perfil do escritório</p>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_2fr]">
        <Select value={prospectId} onValueChange={setProspectId}>
          <SelectTrigger aria-label="Escritório para abordagem">
            <SelectValue placeholder="Selecione o escritório" />
          </SelectTrigger>
          <SelectContent>
            {initialProspects.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="Contexto: como chegou ao contato, indicação, obra recente…"
          aria-label="Contexto do contato"
        />
      </div>
      <div className="mt-3 flex justify-end">
        <Button onClick={generate} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Gerar mensagem
        </Button>
      </div>
      {result && (
        <div className="mt-4 space-y-3 rounded-lg border bg-muted/40 p-4">
          <Textarea value={result} onChange={(e) => setResult(e.target.value)} rows={5} aria-label="Mensagem gerada" />
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => copy(result)}>
              <Copy className="h-4 w-4" /> Copiar
            </Button>
            {prospect && isWhats(prospect) && (
              <Button size="sm" onClick={() => onSend(prospect, result)}>
                <ExternalLink className="h-4 w-4" /> Abrir no WhatsApp
              </Button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function AiReply({ onSend }: { onSend: (p: Prospect, msg: string) => void }) {
  const [prospectId, setProspectId] = useState<string>("");
  const [received, setReceived] = useState("");
  const [context, setContext] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const idRef = useRef(0);

  const prospect = initialProspects.find((p) => String(p.id) === prospectId);

  const generate = async () => {
    if (!prospect) { toast.error("Selecione um escritório."); return; }
    if (received.trim().length < 3) { toast.error("Cole a resposta recebida do escritório."); return; }
    const callId = ++idRef.current;
    setLoading(true);
    setResult("");
    try {
      const res = await generateReply({
        data: { prospectId: prospect.id, reply: received.trim(), context: context.trim() },
      });
      if (callId !== idRef.current) return;
      if (res.error) toast.error(res.error);
      else setResult(res.message ?? "");
    } catch {
      if (callId === idRef.current) toast.error("Não foi possível gerar a resposta agora.");
    } finally {
      if (callId === idRef.current) setLoading(false);
    }
  };

  return (
    <section className="rounded-xl border bg-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <MessageCircle className="h-5 w-5 text-primary" aria-hidden />
        <div>
          <h2 className="font-bold">Responder com IA</h2>
          <p className="text-xs text-muted-foreground">Sugestão de resposta com base no que o escritório escreveu</p>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-[1fr_2fr]">
        <Select value={prospectId} onValueChange={setProspectId}>
          <SelectTrigger aria-label="Escritório para responder">
            <SelectValue placeholder="Selecione o escritório" />
          </SelectTrigger>
          <SelectContent>
            {initialProspects.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="Contexto da conversa (opcional)"
          aria-label="Contexto da conversa"
        />
      </div>
      <Textarea
        className="mt-3"
        value={received}
        onChange={(e) => setReceived(e.target.value)}
        rows={3}
        placeholder="Cole aqui a resposta que o escritório enviou…"
        aria-label="Resposta recebida do escritório"
      />
      <div className="mt-3 flex justify-end">
        <Button onClick={generate} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Sugerir resposta
        </Button>
      </div>
      {result && (
        <div className="mt-4 space-y-3 rounded-lg border bg-muted/40 p-4">
          <Textarea value={result} onChange={(e) => setResult(e.target.value)} rows={5} aria-label="Resposta sugerida" />
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => copy(result)}>
              <Copy className="h-4 w-4" /> Copiar
            </Button>
            {prospect && isWhats(prospect) && (
              <Button size="sm" onClick={() => onSend(prospect, result)}>
                <ExternalLink className="h-4 w-4" /> Abrir no WhatsApp
              </Button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
