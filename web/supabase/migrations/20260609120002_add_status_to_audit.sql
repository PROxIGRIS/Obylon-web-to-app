-- Add missing 'status' column to existing security_audit_logs table
ALTER TABLE public.security_audit_logs 
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'success';
