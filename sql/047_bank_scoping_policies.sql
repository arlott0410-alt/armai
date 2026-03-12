-- ArmAI: Additional policies so service role / backend can insert raw events and processing logs.
-- RLS is enabled; backend uses service role which bypasses RLS by default in Supabase.
-- This file documents intent; no additional policies needed for service role inserts.
-- Merchant and super_admin can read; only backend inserts raw_events and processing_logs.

-- Ensure bank_transactions update policy allows member/super to see scoped columns (already in 009).
-- No change to bank_transactions policies; existing insert is from backend.
