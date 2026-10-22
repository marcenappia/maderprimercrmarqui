-- Per-user isolation for anonymous and registered Supabase users.
-- Existing rows are preserved; rows without an owner remain inaccessible until
-- an administrator explicitly assigns them to the intended account.
ALTER TABLE public.prospects ALTER COLUMN created_by SET DEFAULT auth.uid();
ALTER TABLE public.prospect_interactions ALTER COLUMN created_by SET DEFAULT auth.uid();
ALTER TABLE public.prospect_statuses ALTER COLUMN updated_by SET DEFAULT auth.uid();

DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('prospects', 'prospect_statuses', 'prospect_interactions')
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
  END LOOP;
END $$;

CREATE POLICY prospects_owner_select ON public.prospects
  FOR SELECT TO authenticated USING (created_by = auth.uid());
CREATE POLICY prospects_owner_insert ON public.prospects
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY prospects_owner_update ON public.prospects
  FOR UPDATE TO authenticated USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
CREATE POLICY prospects_owner_delete ON public.prospects
  FOR DELETE TO authenticated USING (created_by = auth.uid());

CREATE POLICY prospect_statuses_owner_select ON public.prospect_statuses
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.prospects p WHERE p.id = prospect_id AND p.created_by = auth.uid())
  );
CREATE POLICY prospect_statuses_owner_insert ON public.prospect_statuses
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.prospects p WHERE p.id = prospect_id AND p.created_by = auth.uid())
    AND updated_by = auth.uid()
  );
CREATE POLICY prospect_statuses_owner_update ON public.prospect_statuses
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.prospects p WHERE p.id = prospect_id AND p.created_by = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.prospects p WHERE p.id = prospect_id AND p.created_by = auth.uid())
    AND updated_by = auth.uid()
  );
CREATE POLICY prospect_statuses_owner_delete ON public.prospect_statuses
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.prospects p WHERE p.id = prospect_id AND p.created_by = auth.uid())
  );

CREATE POLICY prospect_interactions_owner_select ON public.prospect_interactions
  FOR SELECT TO authenticated USING (
    created_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.prospects p WHERE p.id = prospect_id AND p.created_by = auth.uid())
  );
CREATE POLICY prospect_interactions_owner_insert ON public.prospect_interactions
  FOR INSERT TO authenticated WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.prospects p WHERE p.id = prospect_id AND p.created_by = auth.uid())
  );
CREATE POLICY prospect_interactions_owner_update ON public.prospect_interactions
  FOR UPDATE TO authenticated USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());
CREATE POLICY prospect_interactions_owner_delete ON public.prospect_interactions
  FOR DELETE TO authenticated USING (created_by = auth.uid());

-- Partner tables already have owner-scoped policies in migrations 0003 and 0005.
