CREATE TABLE public.prospects (
  id integer GENERATED ALWAYS AS IDENTITY (START WITH 1000) PRIMARY KEY,
  name text NOT NULL,
  focus text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT 'Cadastro manual',
  channel text NOT NULL DEFAULT 'WhatsApp',
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  priority text NOT NULL DEFAULT 'P2',
  notes text NOT NULL DEFAULT '',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prospects TO authenticated;
GRANT ALL ON public.prospects TO service_role;

ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Equipe autenticada lê leads"
  ON public.prospects FOR SELECT TO authenticated USING (true);

CREATE POLICY "Equipe autenticada cadastra leads"
  ON public.prospects FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Equipe autenticada edita leads"
  ON public.prospects FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Equipe autenticada apaga leads"
  ON public.prospects FOR DELETE TO authenticated USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.prospects;