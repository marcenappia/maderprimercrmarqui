CREATE TABLE public.prospect_interactions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  prospect_id integer NOT NULL,
  direction text NOT NULL DEFAULT 'enviada',
  content text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prospect_interactions TO authenticated;
GRANT ALL ON public.prospect_interactions TO service_role;
ALTER TABLE public.prospect_interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Equipe autenticada lê histórico" ON public.prospect_interactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Equipe autenticada registra histórico" ON public.prospect_interactions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Equipe autenticada edita histórico" ON public.prospect_interactions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Equipe autenticada apaga histórico" ON public.prospect_interactions FOR DELETE TO authenticated USING (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.prospect_interactions;