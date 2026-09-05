DELETE FROM public.flyers;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS footer_text TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image_source TEXT;