-- Migration: enable_realtime

BEGIN;
  -- Enable realtime for the tables so the frontend gets live updates
  ALTER PUBLICATION supabase_realtime ADD TABLE public.banned_users;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.unban_requests;
COMMIT;
