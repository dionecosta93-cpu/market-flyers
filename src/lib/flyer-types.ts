export type Offer = {
  id: string;
  name: string;
  brand?: string;
  size?: string;
  unit?: string;
  price: number;
  oldPrice?: number | null;
  category?: string;
  qty?: string;
  badge?: string;
  imagePath?: string | null;
  imageUrl?: string | null;
  highlight?: boolean;
  note?: string;
};

export type FlyerPage = {
  id: string;
  items: Offer[];
};

export type FlyerSettings = {
  headline?: string;
  subheadline?: string;
  storeName?: string;
  logoUrl?: string | null;
  phone?: string;
  whatsapp?: string;
  address?: string;
  instagram?: string;
  validity?: string;
  fontScale?: number;
  showFooter?: boolean;
};

export type FlyerRow = {
  id: string;
  user_id: string;
  title: string;
  template: string;
  format: string;
  per_page: number;
  pages: FlyerPage[];
  settings: FlyerSettings;
  status: string;
  is_paid: boolean;
  download_count: number;
  created_at: string;
  updated_at: string;
};

export const FORMATS = [
  { id: "ig_feed", label: "Instagram Feed", width: 1080, height: 1350 },
  { id: "ig_story", label: "Instagram Story", width: 1080, height: 1920 },
  { id: "whatsapp", label: "WhatsApp (quadrado)", width: 1080, height: 1080 },
  { id: "facebook", label: "Facebook", width: 1200, height: 1500 },
  { id: "a4", label: "A4 (impressão)", width: 1240, height: 1754 },
  { id: "print", label: "Alta resolução", width: 1600, height: 2000 },
] as const;

export function formatById(id: string) {
  return FORMATS.find((f) => f.id === id) ?? FORMATS[0];
}

export const PER_PAGE_OPTIONS = [1, 2, 4, 6, 8, 10, 12, 16, 20];

export function brl(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number.isFinite(value) ? value : 0,
  );
}

export function priceParts(value: number) {
  const fixed = (Number.isFinite(value) ? value : 0).toFixed(2);
  const [int, cents] = fixed.split(",").length > 1 ? fixed.split(",") : fixed.split(".");
  return { int: int ?? "0", cents: cents ?? "00" };
}

export function newId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
