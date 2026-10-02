-- Project X — Migration 0004: readable psychiatrist profiles
-- Run this in the SQL Editor AFTER 0001, 0002, and 0003.
--
-- Bug this fixes: the invite acceptance page (app/invite/[token]/page.tsx)
-- shows the inviting psychiatrist's display name to a patient who hasn't
-- accepted yet -- but the only existing SELECT policies on `profiles`
-- are "read your own profile" and "psychiatrist reads an ACTIVE
-- patient's profile". Neither covers "prospective patient reads the
-- inviting psychiatrist's profile", so that name would silently come
-- back null.
--
-- Fix: psychiatrist profiles are professional-facing by nature (the
-- product's own future direction includes public psychiatrist profiles
-- for discovery), and a display_name alone is not sensitive health
-- data, so it's reasonable for any authenticated user to read a
-- psychiatrist's profile. Patient profiles remain fully protected --
-- this policy only ever applies where role = 'psychiatrist'.

create policy "authenticated users can read psychiatrist profiles"
  on public.profiles for select
  using (role = 'psychiatrist');
