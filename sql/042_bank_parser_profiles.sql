-- ArmAI: Parser registry / parser profiles for versioned bank notification parsing.
-- Additive; does not modify existing tables.

-- Parser profile: versioned, selectable by bank/app/locale/pattern.
create table if not exists public.bank_parser_profiles (
  id uuid primary key default uuid_generate_v4(),
  bank_code text not null,
  parser_family text not null,
  parser_version text not null default '1.0.0',
  locale text,
  source_app_package text,
  detection_pattern text,
  extraction_rules_json jsonb,
  priority int not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.bank_parser_profiles is 'Versioned bank notification parsers. Selection by bank_code, locale, source_app_package, pattern.';
comment on column public.bank_parser_profiles.parser_family is 'e.g. bcel_one_en, bcel_one_lo, ldb_en, generic_fallback.';
comment on column public.bank_parser_profiles.detection_pattern is 'Optional regex/pattern to match raw message for this profile.';
comment on column public.bank_parser_profiles.extraction_rules_json is 'Parser-specific extraction rules (structure depends on parser implementation).';
comment on column public.bank_parser_profiles.priority is 'Lower = higher priority when multiple profiles match.';

create index if not exists idx_bank_parser_profiles_bank_active
  on public.bank_parser_profiles (bank_code, is_active) where is_active = true;
create index if not exists idx_bank_parser_profiles_family
  on public.bank_parser_profiles (parser_family);

-- Seed generic fallback profile (matches existing generic parser ID).
insert into public.bank_parser_profiles (
  id,
  bank_code,
  parser_family,
  parser_version,
  locale,
  priority,
  is_active
) values (
  '00000000-0000-4000-8000-000000000001',
  'GENERIC',
  'generic_fallback',
  '1.0.0',
  null,
  999,
  true
) on conflict (id) do update set
  updated_at = now();
