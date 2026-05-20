-- Add 'editor' role: can edit all content but not manage team
ALTER TYPE public.company_role ADD VALUE IF NOT EXISTS 'editor';