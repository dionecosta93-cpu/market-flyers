export type FlyerTemplate = {
  id: string;
  name: string;
  description: string;
  bg: string;
  header: string;
  headerText: string;
  card: string;
  cardText: string;
  cardBorder: string;
  price: string;
  priceText: string;
  accent: string;
  accentText: string;
  radius: string;
  headingFont: string;
  uppercaseNames: boolean;
  headerLayout: "center" | "logo-left" | "logo-center";
  showPrice: boolean;
  showImage: boolean;
  cardStyle: "bordered" | "shadow" | "flat";
};

export const TEMPLATES: FlyerTemplate[] = [
  {
    id: "oferta-forte",
    name: "Oferta Forte",
    description: "Alto impacto, preços enormes, sensação de promoção.",
    bg: "#d91a1a",
    header: "#ffd400",
    headerText: "#8a0f16",
    card: "#ffffff",
    cardText: "#1c1917",
    cardBorder: "#f5c6c9",
    price: "#ffd400",
    priceText: "#8a0f16",
    accent: "#8a0f16",
    accentText: "#ffffff",
    radius: "16px",
    headingFont: "'Archivo Black', system-ui, sans-serif",
    uppercaseNames: true,
    headerLayout: "logo-left",
    showPrice: true,
    showImage: true,
    cardStyle: "shadow",
  },
  {
    id: "supermercado-moderno",
    name: "Supermercado Moderno",
    description: "Elegante, limpo e profissional.",
    bg: "#0f172a",
    header: "#f8fafc",
    headerText: "#0f172a",
    card: "#1e293b",
    cardText: "#f8fafc",
    cardBorder: "#334155",
    price: "#22c55e",
    priceText: "#ffffff",
    accent: "#f59e0b",
    accentText: "#0f172a",
    radius: "8px",
    headingFont: "'Barlow Condensed', system-ui, sans-serif",
    uppercaseNames: false,
    headerLayout: "logo-center",
    showPrice: true,
    showImage: true,
    cardStyle: "bordered",
  },
  {
    id: "feirao",
    name: "Feirão de Preços",
    description: "Dinâmico, popular e muito promocional.",
    bg: "#0f7a3d",
    header: "#ff8a00",
    headerText: "#ffffff",
    card: "#ffffff",
    cardText: "#123",
    cardBorder: "#cbe6d4",
    price: "#ff8a00",
    priceText: "#ffffff",
    accent: "#ffd400",
    accentText: "#1c3b0d",
    radius: "18px",
    headingFont: "'Archivo Black', system-ui, sans-serif",
    uppercaseNames: true,
    headerLayout: "center",
    showPrice: true,
    showImage: true,
    cardStyle: "shadow",
  },
  {
    id: "premium-black",
    name: "Premium Black",
    description: "Sofisticado, preto e vermelho, alto contraste.",
    bg: "#000000",
    header: "#b91c1c",
    headerText: "#ffffff",
    card: "#111111",
    cardText: "#f5f5f5",
    cardBorder: "#262626",
    price: "#ef4444",
    priceText: "#ffffff",
    accent: "#fbbf24",
    accentText: "#000000",
    radius: "6px",
    headingFont: "'Archivo Black', system-ui, sans-serif",
    uppercaseNames: true,
    headerLayout: "center",
    showPrice: true,
    showImage: true,
    cardStyle: "shadow",
  },
  {
    id: "yellow-promo",
    name: "Promo Amarelo",
    description: "Agressivo e chamativo, amarelo e preto.",
    bg: "#facc15",
    header: "#000000",
    headerText: "#facc15",
    card: "#ffffff",
    cardText: "#111827",
    cardBorder: "#e5e7eb",
    price: "#dc2626",
    priceText: "#ffffff",
    accent: "#000000",
    accentText: "#facc15",
    radius: "12px",
    headingFont: "'Archivo Black', system-ui, sans-serif",
    uppercaseNames: true,
    headerLayout: "center",
    showPrice: true,
    showImage: true,
    cardStyle: "shadow",
  },
  {
    id: "clean-green",
    name: "Clean Green",
    description: "Limpo, fresco e profissional, verde e branco.",
    bg: "#f0fdf4",
    header: "#166534",
    headerText: "#ffffff",
    card: "#ffffff",
    cardText: "#14532d",
    cardBorder: "#bbf7d0",
    price: "#15803d",
    priceText: "#ffffff",
    accent: "#facc15",
    accentText: "#14532d",
    radius: "10px",
    headingFont: "'Barlow Condensed', system-ui, sans-serif",
    uppercaseNames: false,
    headerLayout: "logo-left",
    showPrice: true,
    showImage: true,
    cardStyle: "bordered",
  },
];

export function templateById(id: string): FlyerTemplate {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0]!;
}
