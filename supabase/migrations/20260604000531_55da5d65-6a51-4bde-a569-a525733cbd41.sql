
ALTER TABLE public.signature_settings
  ADD COLUMN IF NOT EXISTS reminder_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminder_interval_days integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS reminder_max_count integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS reminder_channel text NOT NULL DEFAULT 'whatsapp';

ALTER TABLE public.signature_signers
  ADD COLUMN IF NOT EXISTS last_reminder_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS reminder_count integer NOT NULL DEFAULT 0;
