-- Add audit action for system settings (e.g. subscription bank) changes so super_admin can see who changed what.
-- Run once; IF NOT EXISTS avoids error if value already present (PG 9.1+).
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'system_settings_updated';
