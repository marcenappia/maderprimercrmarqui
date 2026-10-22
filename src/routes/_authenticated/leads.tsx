import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import type { Priority } from "@/lib/prospects";
import logoUrl from "@/assets/madeprimer_logo.png";

export const Route = createFileRoute("/_authenticated/leads")({
  head: () => ({
    meta: [
      { title: "Leads — MadePrimer CRM" },
      { name: "description", content: "Cadastro de novos escritórios e contatos de prospecção da MadePrimer." },
    ],
  }),
  component: LeadsPage,
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
  created_at: string;
};

const CHANNELS = ["WhatsApp", "E-mail / Tel", "Telefone", "Formulário", "Instagram"];

function LeadsPage() {
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [focus, setFocus] = useState("");
  const [channel, setChannel] = useState("WhatsApp");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [priority, setPriority] = useState<Priority>("P2");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    let active = true;
    supabase
      .from("prospects")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) toast.error("Não foi possível carregar os leads.");
        setLeads((data ?? []) as LeadRow[]);
        setLoading(false);
      });

    const channelSub = supabase
      .channel("prospects_sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "prospects" }, (payload) => {
        if (payload.eventType === "INSERT") {
          setLeads((prev) => [payload.new as LeadRow, ...prev]);
        } else if (payload.eventType === "DELETE") {
          const old = payload.old as { id?: number };
          if (old.id != null) setLeads((prev) => prev.filter((l) => l.id !== old.id));
        } else if (payload.eventType === "UPDATE") {
          const row = payload.new as LeadRow;
          setLeads((prev) => prev.map((l) => (l.id === row.id ? row : l)));
        }
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channelSub);
    };
  }, []);

  const submit = async () => {
    if (name.trim().length < 2) { toast.error("Informe o nome do escritório."); return; }
    if (channel === "WhatsApp" && phone.replace(/\D/g, "").length < 10) {
      toast.error("Informe um WhatsApp válido com DDD.");
      return;
    }
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const digits = phone.replace(/\D/g, "");
    const phoneRaw = digits && !digits.startsWith("55") ? `55${digits}` : digits;
    const { error } = await supabase.from("prospects").insert({
      name: name.trim(),
      focus: focus.trim(),
      channel,
      phone: phoneRaw,
      email: email.trim(),
      priority,
      notes: notes.trim(),
      created_by: userData.user?.id ?? null,
    });
    setSaving(false);
    if (error) {
      toast.error("Falha ao cadastrar o lead.");
      return;
    }
    toast.success(`${name.trim()} cadastrado.`);
    setName(""); setFocus(""); setPhone(""); setEmail(""); setNotes("");
    setChannel("WhatsApp"); setPriority("P2");
  };

  const remove = async (lead: LeadRow) => {
    if (!window.confirm(`Remover ${lead.name} da lista?`)) return;
    const { error } = await supabase.from("prospects").delete().eq("id", lead.id);
    if (error) toast.error("Falha ao remover.");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-header text-header-foreground">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div className="flex items-center gap-3">
            <img src={logoUrl} alt="MadePrimer — Planejados de Interiores" className="h-11 w-auto" width={1152} height={576} />
            <div>
              <h1 className="text-lg font-bold leading-tight">Leads</h1>
              <p className="text-xs text-header-muted">Cadastro de novos escritórios e contatos</p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm" className="border-header-foreground/30 bg-transparent text-header-foreground hover:bg-header-foreground/10 hover:text-header-foreground">
            <Link to="/"><ArrowLeft className="h-4 w-4" /> Voltar ao painel</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <section className="rounded-xl border bg-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" aria-hidden />
            <div>
              <h2 className="font-bold">Cadastrar novo escritório</h2>
              <p className="text-xs text-muted-foreground">O lead entra na lista do painel com status "A Enviar"</p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label htmlFor="lead-name" className="mb-1 block text-xs font-semibold text-muted-foreground">Nome do escritório *</label>
              <Input id="lead-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Studio Arquitetura" />
            </div>
            <div>
              <label htmlFor="lead-focus" className="mb-1 block text-xs font-semibold text-muted-foreground">Foco / região</label>
              <Input id="lead-focus" value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="Ex.: Residencial Alto Padrão · Alphaville" />
            </div>
            <div>
              <label htmlFor="lead-channel" className="mb-1 block text-xs font-semibold text-muted-foreground">Canal</label>
              <Select value={channel} onValueChange={setChannel}>
                <SelectTrigger id="lead-channel"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CHANNELS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label htmlFor="lead-priority" className="mb-1 block text-xs font-semibold text-muted-foreground">Prioridade</label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger id="lead-priority"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="P1">P1 — Alta</SelectItem>
                  <SelectItem value="P2">P2 — Média</SelectItem>
                  <SelectItem value="P3">P3 — Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label htmlFor="lead-phone" className="mb-1 block text-xs font-semibold text-muted-foreground">WhatsApp / telefone</label>
              <Input id="lead-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" />
            </div>
            <div>
              <label htmlFor="lead-email" className="mb-1 block text-xs font-semibold text-muted-foreground">E-mail</label>
              <Input id="lead-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contato@escritorio.com.br" />
            </div>
          </div>
          <div className="mt-3">
            <label htmlFor="lead-notes" className="mb-1 block text-xs font-semibold text-muted-foreground">Observações</label>
            <Textarea id="lead-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Indicação, obra recente, onde encontrou o contato…" />
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={submit} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Cadastrar lead
            </Button>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border bg-card">
          <div className="border-b bg-muted/50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Leads cadastrados pela equipe ({leads.length})
          </div>
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : leads.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              Nenhum lead cadastrado ainda. Use o formulário acima.
            </p>
          ) : (
            <ul className="divide-y">
              {leads.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <div>
                    <div className="font-semibold">{l.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {[l.focus, l.channel, l.phone || l.email].filter(Boolean).join(" · ")}
                    </div>
                    {l.notes && <div className="mt-0.5 text-xs text-muted-foreground italic">{l.notes}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-primary/40 bg-primary/15 px-2 py-0.5 text-xs font-bold text-accent-foreground">{l.priority}</span>
                    <Button variant="ghost" size="sm" onClick={() => remove(l)} aria-label={`Remover ${l.name}`}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
