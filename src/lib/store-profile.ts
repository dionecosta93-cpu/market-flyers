import { supabase } from "@/integrations/supabase/client";
import type { FlyerSettings } from "@/lib/flyer-types";

export type StoreProfile = {
  store_name: string;
  phone: string;
  whatsapp: string;
  address: string;
  instagram: string;
  footer_text: string;
  logo_url: string | null;
};

export const EMPTY_STORE_PROFILE: StoreProfile = {
  store_name: "",
  phone: "",
  whatsapp: "",
  address: "",
  instagram: "",
  footer_text: "Ofertas válidas enquanto durarem os estoques.",
  logo_url: null,
};

export async function fetchStoreProfile(userId: string): Promise<StoreProfile> {
  const { data } = await supabase
    .from("profiles")
    .select("store_name, phone, whatsapp, address, instagram, footer_text, logo_url")
    .eq("id", userId)
    .maybeSingle();

  if (!data) return { ...EMPTY_STORE_PROFILE };
  return {
    store_name: data.store_name ?? "",
    phone: data.phone ?? "",
    whatsapp: data.whatsapp ?? "",
    address: data.address ?? "",
    instagram: data.instagram ?? "",
    footer_text: data.footer_text ?? EMPTY_STORE_PROFILE.footer_text,
    logo_url: data.logo_url ?? null,
  };
}

export async function saveStoreProfile(userId: string, profile: StoreProfile) {
  const { error } = await supabase.from("profiles").upsert({
    id: userId,
    store_name: profile.store_name,
    phone: profile.phone,
    whatsapp: profile.whatsapp,
    address: profile.address,
    instagram: profile.instagram,
    footer_text: profile.footer_text,
    logo_url: profile.logo_url,
  });
  return error;
}

/** Dados do mercado aplicados automaticamente a um novo encarte. */
export function storeProfileToSettings(profile: StoreProfile): FlyerSettings {
  return {
    storeName: profile.store_name,
    logoUrl: profile.logo_url,
    showLogo: !!profile.logo_url,
    logoScale: 1,
    phone: profile.phone,
    whatsapp: profile.whatsapp,
    address: profile.address,
    instagram: profile.instagram,
    footerText: profile.footer_text,
    showFooter: true,
    showPhone: !!profile.phone,
    showWhatsapp: !!profile.whatsapp,
    showAddress: !!profile.address,
    showInstagram: !!profile.instagram,
  };
}
