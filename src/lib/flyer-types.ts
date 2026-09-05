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
  imageSource?: string | null;
  highlight?: boolean;
  note?: string;
  confident?: boolean;
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
  logoScale?: number;
  showLogo?: boolean;
  phone?: string;
  whatsapp?: string;
  address?: string;
  instagram?: string;
  footerText?: string;
  validity?: string;
  fontScale?: number;
  showFooter?: boolean;
  showPhone?: boolean;
  showWhatsapp?: boolean;
  showAddress?: boolean;
  showInstagram?: boolean;
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
  { id: "whatsapp", label: "WhatsApp (vertical)", width: 1080, height: 1440 },
  { id: "square", label: "Quadrado", width: 1080, height: 1080 },
  { id: "a4", label: "A4 (impressão)", width: 1240, height: 1754 },
] as const;

export function formatById(id: string) {
  return FORMATS.find((f) => f.id === id) ?? FORMATS[0];
}

export const PER_PAGE_OPTIONS = [1, 2, 4, 6, 8, 9, 10, 12, 16, 20];

export const TITLE_PRESETS = [
  "OFERTAS DA SEMANA",
  "SUPER OFERTAS",
  "FEIRÃO DE PREÇOS",
  "OFERTAS DO FIM DE SEMANA",
  "PREÇO BAIXO",
  "OFERTAS IMPERDÍVEIS",
  "FESTIVAL DE PREÇOS",
];

export function brl(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number.isFinite(value) ? value : 0,
  );
}

export function priceParts(value: number) {
  const fixed = (Number.isFinite(value) ? value : 0).toFixed(2);
  const [int, cents] = fixed.split(".");
  return { int: int ?? "0", cents: cents ?? "00" };
}

export function newId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

/** Distribui produtos em páginas mantendo o mesmo estilo visual. */
export function paginate(items: Offer[], perPage: number): FlyerPage[] {
  const size = Math.max(1, perPage || 8);
  if (items.length === 0) return [{ id: newId(), items: [] }];
  const pages: FlyerPage[] = [];
  for (let i = 0; i < items.length; i += size) {
    pages.push({ id: newId(), items: items.slice(i, i + size) });
  }
  return pages;
}
