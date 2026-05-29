-- Pipeline stages must be account-scoped so renaming a Kanban column does not
-- affect another account. Contacts keep their stage_id; this only remaps old
-- global stages to per-account copies.

ALTER TABLE public.pipeline_stages
  ADD COLUMN IF NOT EXISTS account_id uuid;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'accounts'
  )
  AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
     WHERE table_schema = 'public'
       AND table_name = 'pipeline_stages'
       AND constraint_name = 'pipeline_stages_account_id_fkey'
  ) THEN
    ALTER TABLE public.pipeline_stages
      ADD CONSTRAINT pipeline_stages_account_id_fkey
      FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;
  END IF;
END $$;

WITH source_stages AS (
  SELECT DISTINCT ON (position)
    name, slug, color, probability, position, is_active, is_won, is_lost, sla_hours
  FROM public.pipeline_stages
  WHERE account_id IS NULL
  ORDER BY position, created_at NULLS LAST
),
fallback_stages AS (
  SELECT * FROM (VALUES
    ('Novo', 'novo', '#F2C94C', 10::numeric, 0, true, false, false, 24::integer),
    ('Qualificado', 'qualificado', '#2FAE7C', 30::numeric, 1, true, false, false, 48::integer),
    ('Proposta', 'proposta', '#0B3A5D', 50::numeric, 2, true, false, false, 72::integer),
    ('Negociação', 'negociacao', '#6366F1', 70::numeric, 3, true, false, false, NULL::integer),
    ('Ganho', 'ganho', '#22C55E', 100::numeric, 4, true, true, false, NULL::integer),
    ('Perdido', 'perdido', '#EF4444', 0::numeric, 5, true, false, true, NULL::integer)
  ) AS v(name, slug, color, probability, position, is_active, is_won, is_lost, sla_hours)
  WHERE NOT EXISTS (SELECT 1 FROM source_stages)
),
template_stages AS (
  SELECT * FROM source_stages
  UNION ALL
  SELECT * FROM fallback_stages
)
INSERT INTO public.pipeline_stages (
  account_id, name, slug, color, probability, position, is_active, is_won, is_lost, sla_hours
)
SELECT
  a.id,
  t.name,
  t.slug,
  t.color,
  t.probability,
  t.position,
  t.is_active,
  t.is_won,
  t.is_lost,
  t.sla_hours
FROM public.accounts a
CROSS JOIN template_stages t
WHERE NOT EXISTS (
  SELECT 1
    FROM public.pipeline_stages existing
   WHERE existing.account_id = a.id
);

UPDATE public.contacts c
   SET stage_id = account_stage.id
  FROM public.pipeline_stages old_stage
  JOIN public.pipeline_stages account_stage ON true
 WHERE c.stage_id = old_stage.id
   AND old_stage.account_id IS NULL
   AND c.account_id IS NOT NULL
   AND account_stage.account_id = c.account_id
   AND (
     account_stage.slug = old_stage.slug
     OR account_stage.position = old_stage.position
   );

CREATE INDEX IF NOT EXISTS idx_pipeline_stages_account_position
  ON public.pipeline_stages(account_id, position);

CREATE UNIQUE INDEX IF NOT EXISTS pipeline_stages_account_name_unique
  ON public.pipeline_stages(account_id, lower(name))
  WHERE account_id IS NOT NULL;

ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pipeline_stages_all" ON public.pipeline_stages;
DROP POLICY IF EXISTS "pipeline_stages_select_own_account" ON public.pipeline_stages;
DROP POLICY IF EXISTS "pipeline_stages_insert_own_account" ON public.pipeline_stages;
DROP POLICY IF EXISTS "pipeline_stages_update_own_account" ON public.pipeline_stages;
DROP POLICY IF EXISTS "pipeline_stages_delete_own_account" ON public.pipeline_stages;

CREATE POLICY "pipeline_stages_select_own_account"
  ON public.pipeline_stages
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR account_id IN (
      SELECT p.account_id FROM public.profiles p WHERE p.user_id = auth.uid()
      UNION
      SELECT am.account_id FROM public.account_members am WHERE am.user_id = auth.uid() AND am.is_active = true
    )
  );

CREATE POLICY "pipeline_stages_insert_own_account"
  ON public.pipeline_stages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    account_id IS NOT NULL
    AND (
      public.has_role(auth.uid(), 'admin')
      OR account_id IN (
        SELECT p.account_id FROM public.profiles p WHERE p.user_id = auth.uid()
        UNION
        SELECT am.account_id FROM public.account_members am WHERE am.user_id = auth.uid() AND am.is_active = true
      )
    )
  );

CREATE POLICY "pipeline_stages_update_own_account"
  ON public.pipeline_stages
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR account_id IN (
      SELECT p.account_id FROM public.profiles p WHERE p.user_id = auth.uid()
      UNION
      SELECT am.account_id FROM public.account_members am WHERE am.user_id = auth.uid() AND am.is_active = true
    )
  )
  WITH CHECK (
    account_id IS NOT NULL
    AND (
      public.has_role(auth.uid(), 'admin')
      OR account_id IN (
        SELECT p.account_id FROM public.profiles p WHERE p.user_id = auth.uid()
        UNION
        SELECT am.account_id FROM public.account_members am WHERE am.user_id = auth.uid() AND am.is_active = true
      )
    )
  );

CREATE POLICY "pipeline_stages_delete_own_account"
  ON public.pipeline_stages
  FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR account_id IN (
      SELECT p.account_id FROM public.profiles p WHERE p.user_id = auth.uid()
      UNION
      SELECT am.account_id FROM public.account_members am WHERE am.user_id = auth.uid() AND am.is_active = true
    )
  );

NOTIFY pgrst, 'reload schema';
