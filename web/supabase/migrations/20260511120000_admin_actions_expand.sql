-- Phase 5.2 — Expanded Gavel: freeze / unfreeze / kill_task / set_alias
ALTER TYPE public.admin_command ADD VALUE IF NOT EXISTS 'freeze';
ALTER TYPE public.admin_command ADD VALUE IF NOT EXISTS 'unfreeze';
ALTER TYPE public.admin_command ADD VALUE IF NOT EXISTS 'kill_task';
ALTER TYPE public.admin_command ADD VALUE IF NOT EXISTS 'set_alias';

ALTER TABLE public.admin_actions
  ADD COLUMN IF NOT EXISTS metadata jsonb;

CREATE INDEX IF NOT EXISTS admin_actions_target_status_idx
  ON public.admin_actions (target_id, status, created_at DESC);
