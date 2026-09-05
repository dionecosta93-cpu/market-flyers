-- Store profiles: nome, logo e dados do mercado reutilizados em todos os encartes
create table if not exists public.store_profiles (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  store_name text,
  logo_url text,
  phone text,
  whatsapp text,
  address text,
  instagram text,
  footer_text text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.store_profiles enable row level security;

create policy "Users can manage their own store profile"
  on public.store_profiles for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Upsert helper used by the app
create or replace function public.upsert_store_profile(
  p_user_id uuid,
  p_store_name text default null,
  p_logo_url text default null,
  p_phone text default null,
  p_whatsapp text default null,
  p_address text default null,
  p_instagram text default null,
  p_footer_text text default null
) returns public.store_profiles language plpgsql security definer as $$
declare
  result public.store_profiles;
begin
  insert into public.store_profiles (user_id, store_name, logo_url, phone, whatsapp, address, instagram, footer_text)
  values (p_user_id, p_store_name, p_logo_url, p_phone, p_whatsapp, p_address, p_instagram, p_footer_text)
  on conflict (user_id) do update set
    store_name = coalesce(p_store_name, store_profiles.store_name),
    logo_url = coalesce(p_logo_url, store_profiles.logo_url),
    phone = coalesce(p_phone, store_profiles.phone),
    whatsapp = coalesce(p_whatsapp, store_profiles.whatsapp),
    address = coalesce(p_address, store_profiles.address),
    instagram = coalesce(p_instagram, store_profiles.instagram),
    footer_text = coalesce(p_footer_text, store_profiles.footer_text),
    updated_at = now()
  returning * into result;
  return result;
end;
$$;
