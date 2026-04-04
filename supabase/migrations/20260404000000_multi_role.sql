-- Multi-role support: replace single `role` text column with `roles` text[] array.
-- This allows a user to be e.g. both a coach and a parent simultaneously.

-- 1. Add the new array column (nullable during migration, default parent).
ALTER TABLE public.profiles
  ADD COLUMN roles text[] NOT NULL DEFAULT ARRAY['parent']::text[];

-- 2. Migrate every existing row: copy the current single role into the array.
UPDATE public.profiles SET roles = ARRAY[role];

-- 3. Drop the old column and its implicit check constraint.
ALTER TABLE public.profiles DROP COLUMN role;

-- 4. Add a check constraint: array must be non-empty and contain only known roles.
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_roles_valid CHECK (
    array_length(roles, 1) > 0
    AND roles <@ ARRAY['admin', 'coach', 'parent']::text[]
  );

-- 5. Add has_role() — a generic helper used by other functions.
--    SECURITY DEFINER so it bypasses RLS when reading profiles (same pattern
--    as the existing is_admin() to avoid recursive RLS evaluation).
CREATE OR REPLACE FUNCTION public.has_role(required_role text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND required_role = ANY(roles)
  )
$$;

-- 6. Update is_admin() to use the array column.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND 'admin' = ANY(roles)
  )
$$;

-- 7. Update current_user_role() to return the highest-privilege role for
--    any code that still reads a single string (admin > coach > parent).
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN 'admin' = ANY(roles) THEN 'admin'
    WHEN 'coach' = ANY(roles) THEN 'coach'
    ELSE 'parent'
  END
  FROM public.profiles WHERE id = auth.uid()
$$;
