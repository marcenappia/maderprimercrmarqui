import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarCheck, Flame, LayoutDashboard, MessagesSquare } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { initialProspects, type Status } from "@/lib/prospects";
import logoUrl from "@/assets/madeprimer_logo.png";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "MadePrimer CRM — Dashboard de Clientes" },
      { name: "description", content: "Acompanhamento do funil de prospecção e das conversas com escritórios de arquitetura." },
    ],
  }),
  component: Dashboard,
});

const STATUS_CFG: { value: Status; label: string; dot: string }[] = [
  { value: "A Enviar", label: "A Enviar", dot: "bg-slate-400" },
  { value: "WhatsApp Aberto", label: "WhatsApp Aberto", dot: "bg-sky-500" },
  { value: "Mensagem Enviada", label: "Mensagem Enviada", dot: "bg-blue-500" },
  { value: "Em Conversa", label: "Em Conversa", dot: "bg-violet-500" },
  { value: "Reunião Agendada", label: "Reunião Agendada", dot: "bg-emerald-500" },
  { value: "Sem Interesse", label: "Sem Interesse", dot: "bg-rose-500" },
];

type LeadRow = { id: number; name: string; focus: string };
type Interaction = {
  id: number;
  prospect_id: number;
  direction: "enviada" | "recebida";
  content: string;
  created_at: string;
};

function Dashboard() {
  const [statuses, setStatuses] = useState<Record<number, Status>>({});
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [interactions, setInteractions] = useState<Interaction[]>([]);

  useEffect(() => {
    let active = true;
    supabase
      .from("prospect_statuses")
      .select("prospect_id, status")
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          toast.error("Não foi possível carregar os status.");
          return;
        }
        const map: Record<number, Status> = {};
        for (const row of data ?? []) map[row.prospect_id] = row.status as Status;
        setStatuses(map);
      });
    supabase
      .from("prospects")
      .select("id, name, focus")
      .then(({ data, error }) => {
        if (!active) return;
        if (error) toast.error("Não foi possível carregar os leads.");
        setLeads((data ?? []) as LeadRow[]);
      });
    supabase
      .from("prospect_interactions")
      .select("id, prospect_id, direction, content, created_at")
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) toast.error("Não foi possível carregar o histórico recente.");
        setInteractions((data ?? []) as Interaction[]);
      });

    const channel = supabase
      .channel("dashboard_sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "prospect_statuses" }, (payload) => {
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
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "prospect_interactions" }, (payload) => {
        const row = payload.new as Interaction;
        setInteractions((prev) => (prev.some((i) => i.id === row.id) ? prev : [row, ...prev].slice(0, 20)));
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const nameOf = useMemo(() => {
    const map = new Map<number, { name: string; focus: string }>();
    for (const p of initialProspects) map.set(p.id, { name: p.name, focus: p.focus });
    for (const l of leads) map.set(l.id, { name: l.name, focus: l.focus });
    return (id: number) => map.get(id) ?? { name: `Escritório #${id}`, focus: "" };
  }, [leads]);

  const statusOf = (id: number): Status => statuses[id] ?? "A Enviar";

  const total = initialProspects.length + leads.length;

  const byStatus = useMemo(() => {
    const counts = new Map<Status, number>(STATUS_CFG.map((s) => [s.value, 0]));
    for (const p of initialProspects) counts.set(statusOf(p.id), (counts.get(statusOf(p.id)) ?? 0) + 1);
    for (const l of leads) counts.set(statusOf(l.id), (counts.get(statusOf(l.id)) ?? 0) + 1);
    return counts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statuses, leads]);

  const active = useMemo(() => {
    const ids = [...initialProspects.map((p) => p.id), ...leads.map((l) => l.id)];
    return ids
      .filter((id) => statusOf(id) === "Em Conversa" || statusOf(id) === "Reunião Agendada")
      .map((id) => ({ id, ...nameOf(id), status: statusOf(id) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statuses, leads, nameOf]);

  const meetings = byStatus.get("Reunião Agendada") ?? 0;
  const talking = byStatus.get("Em Conversa") ?? 0;
  const sent = (byStatus.get("Mensagem Enviada") ?? 0) + talking + meetings + (byStatus.get("Sem Interesse") ?? 0);
  const convRate = sent > 0 ? Math.round(((talking + meetings) / sent) * 100) : 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-header text-header-foreground">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div className="flex items-center gap-3">
            <img src={logoUrl} alt="MadePrimer — Planejados de Interiores" className="h-11 w-auto" width={1152} height={576} />
            <div>
              <h1 className="flex items-center gap-2 text-lg font-bold leading-tight">
                <LayoutDashboard className="h-5 w-5" /> Dashboard de Clientes
              </h1>
              <p className="text-xs text-header-muted">Acompanhamento do funil de prospecção</p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm" className="border-header-foreground/30 bg-transparent text-header-foreground hover:bg-header-foreground/10 hover:text-header-foreground">
            <Link to="/"><ArrowLeft className="h-4 w-4" /> Voltar ao painel</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border bg-card px-4 py-4 text-center">
            <div className="text-2xl font-extrabold">{total}</div>
            <div className="text-xs text-muted-foreground">Escritórios</div>
          </div>
          <div className="rounded-xl border bg-card px-4 py-4 text-center">
            <div className="flex items-center justify-center gap-1 text-2xl font-extrabold text-violet-600">
              <Flame className="h-5 w-5" /> {talking}
            </div>
            <div className="text-xs text-muted-foreground">Em conversa</div>
          </div>
          <div className="rounded-xl border bg-card px-4 py-4 text-center">
            <div className="flex items-center justify-center gap-1 text-2xl font-extrabold text-emerald-600">
              <CalendarCheck className="h-5 w-5" /> {meetings}
            </div>
            <div className="text-xs text-muted-foreground">Reuniões agendadas</div>
          </div>
          <div className="rounded-xl border bg-card px-4 py-4 text-center">
            <div className="text-2xl font-extrabold text-primary">{convRate}%</div>
            <div className="text-xs text-muted-foreground">Conversão em conversa</div>
          </div>
        </section>

        <section className="rounded-xl border bg-card p-5">
          <h2 className="text-base font-bold">Funil de prospecção</h2>
          <div className="mt-4 space-y-2">
            {STATUS_CFG.map((s) => {
              const count = byStatus.get(s.value) ?? 0;
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <div key={s.value} className="flex items-center gap-3">
                  <span className="flex w-36 items-center gap-2 text-xs font-medium">
                    <span className={cn("h-2.5 w-2.5 rounded-full", s.dot)} /> {s.label}
                  </span>
                  <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className={cn("h-full rounded-full", s.dot)} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-10 text-right text-xs font-bold">{count}</span>
                </div>
              );
            })}
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="overflow-hidden rounded-xl border bg-card">
            <div className="border-b bg-muted/50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Parcerias em andamento ({active.length})
            </div>
            {active.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                Nenhum escritório em conversa ou com reunião agendada no momento.
              </p>
            ) : (
              <ul className="divide-y">
                {active.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{a.name}</div>
                      <div className="truncate text-xs text-muted-foreground">{a.focus}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-bold",
                          a.status === "Reunião Agendada" ? "bg-emerald-100 text-emerald-800" : "bg-violet-100 text-violet-800",
                        )}
                      >
                        {a.status}
                      </span>
                      <Button asChild size="sm" variant="outline">
                        <Link to="/prospects/$id" params={{ id: String(a.id) }}>Histórico</Link>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="overflow-hidden rounded-xl border bg-card">
            <div className="flex items-center gap-2 border-b bg-muted/50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <MessagesSquare className="h-4 w-4" /> Últimas interações da equipe
            </div>
            {interactions.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                Nenhuma interação registrada ainda. Use o histórico de cada escritório.
              </p>
            ) : (
              <ul className="divide-y">
                {interactions.map((i) => (
                  <li key={i.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span
                        className={cn(
                          "inline-block h-2 w-2 rounded-full",
                          i.direction === "enviada" ? "bg-blue-500" : "bg-emerald-500",
                        )}
                      />
                      <Link
                        to="/prospects/$id"
                        params={{ id: String(i.prospect_id) }}
                        className="font-semibold text-foreground hover:underline"
                      >
                        {nameOf(i.prospect_id).name}
                      </Link>
                      <span>{i.direction === "enviada" ? "enviou" : "respondeu"}</span>
                      <span>
                        {new Date(i.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm">{i.content}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
