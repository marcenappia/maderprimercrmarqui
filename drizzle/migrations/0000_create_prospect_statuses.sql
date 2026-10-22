CREATE TABLE public.prospect_statuses (
  prospect_id integer PRIMARY KEY,
  status text NOT NULL DEFAULT 'A Enviar',
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prospect_statuses TO authenticated;
GRANT ALL ON public.prospect_statuses TO service_role;

ALTER TABLE public.prospect_statuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Equipe autenticada lê status"
  ON public.prospect_statuses FOR SELECT TO authenticated USING (true);

CREATE POLICY "Equipe autenticada grava status"
  ON public.prospect_statuses FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Equipe autenticada atualiza status"
  ON public.prospect_statuses FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Equipe autenticada apaga status"
  ON public.prospect_statuses FOR DELETE TO authenticated USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.prospect_statuses;