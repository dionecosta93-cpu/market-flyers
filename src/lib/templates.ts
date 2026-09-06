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
];

export function templateById(id: string): FlyerTemplate {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0]!;
}
