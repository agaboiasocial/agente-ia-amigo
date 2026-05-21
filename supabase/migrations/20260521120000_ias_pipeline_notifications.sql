-- ============================================================
-- IAS Migration: Pipeline, Notifications, Finance, Lead extras
-- Does NOT drop or alter existing tables destructively.
-- ============================================================

-- 1. Pipeline Stages (configurable kanban columns)
CREATE TABLE IF NOT EXISTS pipeline_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  color text NOT NULL DEFAULT '#6366F1',
  probability numeric NOT NULL DEFAULT 0,
  position integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  is_won boolean NOT NULL DEFAULT false,
  is_lost boolean NOT NULL DEFAULT false,
  sla_hours integer DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pipeline_stages_all" ON pipeline_stages FOR ALL USING (true) WITH CHECK (true);

-- 2. Loss Reasons
CREATE TABLE IF NOT EXISTS loss_reasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE loss_reasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loss_reasons_all" ON loss_reasons FOR ALL USING (true) WITH CHECK (true);

-- 3. Add pipeline fields to contacts (makes contacts work as leads)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contacts' AND column_name='stage_id') THEN
    ALTER TABLE contacts ADD COLUMN stage_id uuid REFERENCES pipeline_stages(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contacts' AND column_name='estimated_value') THEN
    ALTER TABLE contacts ADD COLUMN estimated_value numeric DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contacts' AND column_name='probability') THEN
    ALTER TABLE contacts ADD COLUMN probability numeric DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contacts' AND column_name='source') THEN
    ALTER TABLE contacts ADD COLUMN source text DEFAULT 'manual';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contacts' AND column_name='assigned_to') THEN
    ALTER TABLE contacts ADD COLUMN assigned_to uuid;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contacts' AND column_name='lead_score') THEN
    ALTER TABLE contacts ADD COLUMN lead_score integer DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contacts' AND column_name='won_at') THEN
    ALTER TABLE contacts ADD COLUMN won_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contacts' AND column_name='lost_at') THEN
    ALTER TABLE contacts ADD COLUMN lost_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contacts' AND column_name='loss_reason_id') THEN
    ALTER TABLE contacts ADD COLUMN loss_reason_id uuid REFERENCES loss_reasons(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contacts' AND column_name='stage_entered_at') THEN
    ALTER TABLE contacts ADD COLUMN stage_entered_at timestamptz DEFAULT now();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contacts' AND column_name='last_contact_at') THEN
    ALTER TABLE contacts ADD COLUMN last_contact_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contacts' AND column_name='ai_paused') THEN
    ALTER TABLE contacts ADD COLUMN ai_paused boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contacts' AND column_name='notes') THEN
    ALTER TABLE contacts ADD COLUMN notes text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contacts' AND column_name='updated_at') THEN
    ALTER TABLE contacts ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- 4. Lead Notes
CREATE TABLE IF NOT EXISTS lead_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  author_id uuid,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE lead_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lead_notes_all" ON lead_notes FOR ALL USING (true) WITH CHECK (true);

-- 5. Lead Tasks
CREATE TABLE IF NOT EXISTS lead_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  assigned_to uuid,
  due_date timestamptz,
  is_completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE lead_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lead_tasks_all" ON lead_tasks FOR ALL USING (true) WITH CHECK (true);

-- 6. Lead Movements (pipeline history)
CREATE TABLE IF NOT EXISTS lead_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  from_stage_id uuid REFERENCES pipeline_stages(id),
  to_stage_id uuid REFERENCES pipeline_stages(id),
  moved_by uuid,
  loss_reason_id uuid REFERENCES loss_reasons(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE lead_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lead_movements_all" ON lead_movements FOR ALL USING (true) WITH CHECK (true);

-- 7. Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  description text,
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_own" ON notifications FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 8. Payment Schedules (finance)
CREATE TABLE IF NOT EXISTS payment_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  amount numeric NOT NULL DEFAULT 0,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  paid_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE payment_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payment_schedules_all" ON payment_schedules FOR ALL USING (true) WITH CHECK (true);

-- 9. AI Settings
CREATE TABLE IF NOT EXISTS ai_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_name text DEFAULT 'IAS Assistente',
  system_prompt text DEFAULT 'Você é o IAS, atendente virtual. Seja cordial, objetivo e use português brasileiro.',
  model text DEFAULT 'gpt-4o-mini',
  temperature numeric DEFAULT 0.7,
  is_active boolean DEFAULT true,
  schedule_enabled boolean DEFAULT false,
  schedule_days text[] DEFAULT ARRAY['seg','ter','qua','qui','sex'],
  schedule_start text DEFAULT '09:00',
  schedule_end text DEFAULT '18:00',
  off_hours_message text DEFAULT 'Estamos fora do horário de atendimento.',
  handoff_keyword text DEFAULT '#humano',
  buffer_seconds integer DEFAULT 3,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ai_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_settings_all" ON ai_settings FOR ALL USING (true) WITH CHECK (true);

-- 10. Saved Views (for leads table)
CREATE TABLE IF NOT EXISTS saved_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}',
  columns text[] DEFAULT ARRAY['name','phone','email','stage','value','source','created_at'],
  created_by uuid,
  is_default boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE saved_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "saved_views_all" ON saved_views FOR ALL USING (true) WITH CHECK (true);

-- 11. Add plan fields to accounts if not present
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='accounts' AND column_name='plan_type') THEN
    ALTER TABLE accounts ADD COLUMN plan_type text DEFAULT 'free';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='accounts' AND column_name='plan_value') THEN
    ALTER TABLE accounts ADD COLUMN plan_value numeric DEFAULT 0;
  END IF;
END $$;

-- 12. Insert default pipeline stages if table is empty
INSERT INTO pipeline_stages (name, slug, color, probability, position, is_active, is_won, is_lost)
SELECT * FROM (VALUES
  ('Novo',         'novo',         '#F2C94C', 10, 0, true, false, false),
  ('Qualificado',  'qualificado',  '#2FAE7C', 30, 1, true, false, false),
  ('Proposta',     'proposta',     '#0B3A5D', 50, 2, true, false, false),
  ('Negociação',   'negociacao',   '#6366F1', 70, 3, true, false, false),
  ('Ganho',        'ganho',        '#22C55E', 100, 4, true, true,  false),
  ('Perdido',      'perdido',      '#EF4444', 0,   5, true, false, true)
) AS v(name, slug, color, probability, position, is_active, is_won, is_lost)
WHERE NOT EXISTS (SELECT 1 FROM pipeline_stages LIMIT 1);

-- 13. Insert default loss reasons if table is empty
INSERT INTO loss_reasons (name, is_active)
SELECT * FROM (VALUES
  ('Preço alto', true),
  ('Concorrente', true),
  ('Sem orçamento', true),
  ('Sem resposta', true),
  ('Timing inadequado', true),
  ('Produto não atende', true),
  ('Outro', true)
) AS v(name, is_active)
WHERE NOT EXISTS (SELECT 1 FROM loss_reasons LIMIT 1);

-- 14. Insert default AI settings if table is empty
INSERT INTO ai_settings (persona_name, system_prompt, model, is_active)
SELECT 'IAS Assistente',
       'Você é o IAS, atendente virtual da empresa. Seja cordial, objetivo e use português brasileiro. Sempre que não souber, ofereça transferir para um agente humano.',
       'gpt-4o-mini',
       true
WHERE NOT EXISTS (SELECT 1 FROM ai_settings LIMIT 1);
