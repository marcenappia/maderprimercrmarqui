import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Clock, Copy, Hammer, PenLine, RotateCcw, Search, SearchX, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { followUpTemplate, initialProspects, type Prospect, type Status } from "@/lib/prospects";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Painel de Prospecção — MadePrimer CRM" },
      { name: "description", content: "Prospecção ativa e follow-up via WhatsApp de 50 escritórios de arquitetura para a MadePrimer." },
      { property: "og:title", content: "Painel de Prospecção — MadePrimer CRM" },
      { property: "og:description", content: "Prospecção ativa e follow-up via WhatsApp de escritórios de arquitetura." },
    ],
  }),
  component: Index,
});

const STORAGE_KEY = "madeprimer_prospects_status";
const STATUSES: { value: Status; label: string; cls: string }[] = [
  { value: "A Enviar", label: "⏳ A Enviar", cls: "bg-muted text-foreground border-border" },
  { value: "Mensagem Enviada", label: "🚀 Mensagem Enviada", cls: "bg-success/10 text-success border-success/30" },
  { value: "Em Conversa", label: "💬 Em Conversa", cls: "bg-chart-2/10 text-chart-2 border-chart-2/30" },
  { value: "Reunião Agendada", label: "📅 Reunião Agendada", cls: "bg-primary/10 text-accent-foreground border-primary/30" },
  { value: "Sem Interesse", label: "❌ Sem Interesse", cls: "bg-destructive/10 text-destructive border-destructive/30" },
];
const PRIORITY: Record<"P1" | "P2" | "P3", { label: string; cls: string }> = {
  P1: { label: "PRIORIDADE 1", cls: "bg-destructive/10 text-destructive" },
  P2: { label: "PRIORIDADE 2", cls: "bg-primary/15 text-accent-foreground" },
  P3: { label: "PRIORIDADE 3", cls: "bg-chart-3/10 text-chart-3" },
};

const isWhats = (p: Prospect) => p.phoneRaw.startsWith("55");
const waUrl = (phone: string, text: string) =>
  `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`;

async function copy(text: string, msg = "Mensagem copiada!") {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(msg);
  } catch {
    toast.error("Não foi possível copiar.");
  }
}

function Index() {
  const [prospects, setProspects] = useState<Prospect[]>(initialProspects);
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [modal, setModal] = useState<{ id: number; tab: "initial" | "followup" } | null>(null);
  const [text, setText] = useState("");

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") as Record<number, Status>;
      setProspects((ps) => ps.map((p) => { const st = saved[p.id]; return st ? { ...p, status: st } : p; }));
    } catch { /* ignora dados corrompidos */ }
  }, []);

  const setStatus = (id: number, status: Status) => {
    setProspects((ps) => {
      const next = ps.map((p) => (p.id === id ? { ...p, status } : p));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(next.map((p) => [p.id, p.status]))));
      return next;
    });
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return prospects.filter(
      (p) =>
        [p.name, p.focus, p.phoneFormatted, p.source].some((v) => v.toLowerCase().includes(q)) &&
        (priority === "ALL" || p.priority === priority) &&
        (statusFilter === "ALL" || p.status === statusFilter),
    );
  }, [prospects, search, priority, statusFilter]);

  const sent = prospects.filter((p) => p.status !== "A Enviar").length;
  const active = modal ? prospects.find((p) => p.id === modal.id) : undefined;

  const openModal = (id: number, tab: "initial" | "followup") => {
    const p = prospects.find((x) => x.id === id)!;
    setText(tab === "initial" ? p.message : p.followUp);
    setModal({ id, tab });
  };

  const trackSent = (p: Prospect) => {
    if (p.status === "A Enviar") setStatus(p.id, "Mensagem Enviada");
  };

  const selectCls = "h-9 rounded-lg border border-input bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-ring/50";

  return (
    <div className="flex min-h-screen flex-col font-sans antialiased">
      <header className="sticky top-0 z-30 bg-header text-header-foreground shadow-md">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary p-2.5 text-primary-foreground shadow-lg">
              <Hammer className="h-6 w-6" aria-hidden />
            </div>
            <div>
              <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
                MadePrimer
                <span className="rounded-full border border-primary/40 bg-primary/20 px-2.5 py-0.5 text-xs font-semibold text-primary">CRM WhatsApp</span>
              </h1>
              <p className="text-xs text-header-muted">Prospecção ativa & follow-up de escritórios de arquitetura ({prospects.length} contatos)</p>
            </div>
          </div>
          <div className="flex gap-2 text-xs sm:gap-4">
            {[
              ["Total", prospects.length, "text-header-foreground"],
              ["Enviados", sent, "text-success"],
              ["Pendentes", prospects.length - sent, "text-primary"],
            ].map(([l, v, c]) => (
              <div key={l as string} className="min-w-[80px] rounded-lg border border-header-muted/20 bg-header-foreground/5 px-3 py-2 text-center">
                <span className="block font-medium text-header-muted">{l}</span>
                <span className={cn("text-base font-bold", c as string)}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col items-center justify-between gap-4 rounded-2xl border bg-card p-4 shadow-sm md:flex-row">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por escritório, contato ou região..." className="pl-9" aria-label="Buscar" />
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 md:w-auto md:justify-end">
            <select aria-label="Prioridade" value={priority} onChange={(e) => setPriority(e.target.value)} className={selectCls}>
              <option value="ALL">Todas as Prioridades</option>
              <option value="P1">Prioridade 1 (Imediato - Site Validado)</option>
              <option value="P2">Prioridade 2 (Alphaville/Tamboré)</option>
              <option value="P3">Prioridade 3 (Barueri/Zona Oeste/Alto de Pinheiros)</option>
            </select>
            <select aria-label="Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectCls}>
              <option value="ALL">Todos os Status</option>
              {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm"><RotateCcw className="h-3.5 w-3.5" /> Resetar</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Resetar status?</AlertDialogTitle>
                  <AlertDialogDescription>Todos os contatos voltarão para "A Enviar".</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => {
                    localStorage.removeItem(STORAGE_KEY);
                    setProspects((ps) => ps.map((p) => ({ ...p, status: "A Enviar" })));
                    toast.success("Status zerados com sucesso!");
                  }}>Resetar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b bg-muted/70 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <th className="w-12 p-4 text-center">#</th>
                  <th className="p-4">Escritório / Contato</th>
                  <th className="p-4">Região / Foco</th>
                  <th className="p-4">Telefone / Canal</th>
                  <th className="w-40 p-4">Status</th>
                  <th className="min-w-[240px] p-4 text-center">Disparo / Follow-up</th>
                </tr>
              </thead>
              <tbody className="divide-y text-sm">
                {filtered.map((p) => {
                  const st = STATUSES.find((s) => s.value === p.status)!;
                  return (
                    <tr key={p.id} className="transition-colors hover:bg-muted/40">
                      <td className="p-4 text-center text-xs font-bold text-muted-foreground">{p.id}</td>
                      <td className="p-4">
                        <div className="font-semibold">{p.name}</div>
                        <div className="mt-1 flex items-center gap-1.5">
                          <span className={cn("rounded-md px-2 py-0.5 text-[10px] font-bold", PRIORITY[p.priority].cls)}>{PRIORITY[p.priority].label}</span>
                          <span className="rounded border px-1.5 text-[10px] text-muted-foreground">{p.source}</span>
                        </div>
                      </td>
                      <td className="p-4 text-xs text-muted-foreground">{p.focus}</td>
                      <td className="p-4 text-xs">
                        <div className="font-mono font-medium">{p.phoneFormatted}</div>
                        <span className="text-[10px] text-muted-foreground">{p.channel}</span>
                      </td>
                      <td className="p-4">
                        <select aria-label={`Status de ${p.name}`} value={p.status} onChange={(e) => setStatus(p.id, e.target.value as Status)}
                          className={cn("cursor-pointer rounded-lg border px-2.5 py-1.5 text-xs font-medium focus:outline-none", st.cls)}>
                          {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-1.5">
                          {isWhats(p) ? (
                            <Button asChild size="sm" className="bg-success text-success-foreground hover:bg-success/90">
                              <a href={waUrl(p.phoneRaw, p.message)} target="_blank" rel="noreferrer" onClick={() => trackSent(p)}>
                                <Send className="h-3.5 w-3.5" /> 1º Contato
                              </a>
                            </Button>
                          ) : (
                            <Button size="sm" variant="secondary" onClick={() => openModal(p.id, "initial")}>
                              <Copy className="h-3.5 w-3.5" /> Ver 1º
                            </Button>
                          )}
                          <Button size="sm" variant="outline" className="border-primary/30 bg-accent text-accent-foreground hover:bg-primary/15" onClick={() => openModal(p.id, "followup")}>
                            <Clock className="h-3.5 w-3.5" /> Follow-up
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Ver detalhes" onClick={() => openModal(p.id, "initial")}>
                            <PenLine className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="p-12 text-center">
              <SearchX className="mx-auto mb-3 h-12 w-12 text-muted-foreground/50" aria-hidden />
              <h3 className="mb-1 font-semibold">Nenhum contato encontrado</h3>
              <p className="text-xs text-muted-foreground">Tente ajustar a busca ou os filtros aplicados.</p>
            </div>
          )}
        </div>

        <div className="mt-8 flex flex-col items-start justify-between gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-5 md:flex-row md:items-center">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-xl bg-primary/10 p-2.5 text-accent-foreground"><Clock className="h-5 w-5" aria-hidden /></div>
            <div>
              <h3 className="text-sm font-semibold">Roteiro padrão de follow-up (3 a 5 dias sem resposta)</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">Integrado no botão <b>Follow-up</b> de cada contato da lista.</p>
            </div>
          </div>
          <Button className="w-full md:w-auto" onClick={() => copy(followUpTemplate, "Script de follow-up copiado!")}>
            <Copy className="h-4 w-4" /> Copiar script padrão
          </Button>
        </div>
      </main>

      <Dialog open={!!modal} onOpenChange={(o) => !o && setModal(null)}>
        <DialogContent className="max-w-2xl">
          {active && modal && (
            <>
              <DialogHeader>
                <DialogTitle>{active.name}</DialogTitle>
                <DialogDescription>Destino: {active.channel} — {active.phoneFormatted}</DialogDescription>
              </DialogHeader>
              <Tabs value={modal.tab} onValueChange={(t) => openModal(active.id, t as "initial" | "followup")}>
                <TabsList>
                  <TabsTrigger value="initial"><Send className="h-3.5 w-3.5" /> 1º Contato</TabsTrigger>
                  <TabsTrigger value="followup"><Clock className="h-3.5 w-3.5" /> Follow-up (3 a 5 dias)</TabsTrigger>
                </TabsList>
              </Tabs>
              <label htmlFor="msg" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Conteúdo da mensagem (editável)</label>
              <Textarea id="msg" rows={7} value={text} onChange={(e) => setText(e.target.value)} className="leading-relaxed" />
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                <Button variant="outline" onClick={() => copy(text)}><Copy className="h-4 w-4" /> Apenas copiar</Button>
                {isWhats(active) ? (
                  <Button asChild className="bg-success text-success-foreground hover:bg-success/90">
                    <a href={waUrl(active.phoneRaw, text)} target="_blank" rel="noreferrer" onClick={() => { trackSent(active); setModal(null); }}>
                      <Send className="h-4 w-4" /> Disparar WhatsApp
                    </a>
                  </Button>
                ) : (
                  <p className="self-center text-xs text-muted-foreground">Sem WhatsApp — copie e envie por {active.channel}.</p>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
