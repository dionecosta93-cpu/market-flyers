import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type ImageCandidate = {
  url: string;
  title: string;
  source: string;
  sourceUrl: string;
  score: number;
  fromLibrary?: boolean;
};

const OFF_ENDPOINT = "https://world.openfoodfacts.org/cgi/search.pl";

function norm(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value: string) {
  return norm(value).split(" ").filter((t) => t.length > 2);
}

/** Pontua o quanto um produto encontrado corresponde ao produto pedido. */
function scoreCandidate(
  wanted: { name: string; brand: string; size: string },
  found: { name: string; brand: string; size: string },
) {
  let score = 0;
  const wantedName = tokens(wanted.name);
  const foundName = norm(`${found.name} ${found.brand}`);
  wantedName.forEach((t) => {
    if (foundName.includes(t)) score += 3;
  });
  if (wanted.brand) {
    const brandTokens = tokens(wanted.brand);
    brandTokens.forEach((t) => {
      if (norm(`${found.brand} ${found.name}`).includes(t)) score += 5;
    });
  }
  if (wanted.size) {
    const digits = norm(wanted.size).replace(/[^0-9]/g, "");
    const foundDigits = norm(found.size).replace(/[^0-9]/g, "");
    if (digits && foundDigits && foundDigits.includes(digits)) score += 4;
    else if (digits && norm(found.name).includes(digits)) score += 2;
  }
  return score;
}

async function searchOpenFoodFacts(query: string, wanted: { name: string; brand: string; size: string }) {
  const url = `${OFF_ENDPOINT}?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=16&fields=product_name,product_name_pt,brands,quantity,image_front_url,code`;
  const res = await fetch(url, {
    headers: { "User-Agent": "MarketFlyers/1.0 (encartes de supermercado)" },
  });
  if (!res.ok) return [] as ImageCandidate[];
  const json = (await res.json()) as { products?: Array<Record<string, unknown>> };
  const products = Array.isArray(json.products) ? json.products : [];

  const candidates: ImageCandidate[] = [];
  for (const p of products) {
    const image = typeof p["image_front_url"] === "string" ? (p["image_front_url"] as string) : "";
    if (!image) continue;
    const name = String(p["product_name_pt"] || p["product_name"] || "").trim();
    const brand = String(p["brands"] || "").trim();
    const size = String(p["quantity"] || "").trim();
    if (!name) continue;
    const code = String(p["code"] || "");
    candidates.push({
      url: image,
      title: [name, brand, size].filter(Boolean).join(" · "),
      source: "Open Food Facts",
      sourceUrl: code ? `https://world.openfoodfacts.org/product/${code}` : "https://world.openfoodfacts.org",
      score: scoreCandidate(wanted, { name, brand, size }),
    });
  }
  return candidates;
}

/**
 * Procura imagens reais do produto: primeiro na biblioteca do próprio usuário,
 * depois em base pública de produtos (Open Food Facts).
 */
export const searchProductImages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { name: string; brand?: string; size?: string }) =>
    z
      .object({
        name: z.string().min(1).max(160),
        brand: z.string().max(80).optional(),
        size: z.string().max(60).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const wanted = { name: data.name, brand: data.brand ?? "", size: data.size ?? "" };
    const candidates: ImageCandidate[] = [];

    // 1. Biblioteca do usuário (mais rápido e já aprovado por ele)
    try {
      const { data: rows } = await context.supabase
        .from("products")
        .select("name, brand, size, image_url, image_source")
        .eq("user_id", context.userId)
        .not("image_url", "is", null)
        .ilike("name", `%${data.name.slice(0, 40)}%`)
        .limit(5);
      (rows ?? []).forEach((row) => {
        if (!row.image_url) return;
        candidates.push({
          url: row.image_url,
          title: [row.name, row.brand, row.size].filter(Boolean).join(" · "),
          source: "Sua biblioteca",
          sourceUrl: row.image_source ?? "",
          score:
            100 +
            scoreCandidate(wanted, {
              name: row.name ?? "",
              brand: row.brand ?? "",
              size: row.size ?? "",
            }),
          fromLibrary: true,
        });
      });
    } catch (error) {
      console.error("library lookup failed", error);
    }

    // 2. Base pública de produtos — busca específica (nome + marca + peso)
    const queries = [
      [data.brand, data.name, data.size].filter(Boolean).join(" "),
      [data.brand, data.name].filter(Boolean).join(" "),
      data.name,
    ].filter((q, i, arr) => q && arr.indexOf(q) === i);

    for (const query of queries) {
      try {
        const found = await searchOpenFoodFacts(query, wanted);
        found.forEach((c) => {
          if (!candidates.some((existing) => existing.url === c.url)) candidates.push(c);
        });
      } catch (error) {
        console.error("openfoodfacts failed", error);
      }
      if (candidates.filter((c) => c.score >= 8).length >= 4) break;
    }

    candidates.sort((a, b) => b.score - a.score);
    return { candidates: candidates.slice(0, 8) };
  });

/** Baixa a imagem escolhida e devolve em base64 para que a exportação saia sem falhas. */
export const importImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { url: string }) => z.object({ url: z.string().min(4).max(2000) }).parse(input))
  .handler(async ({ data }) => {
    if (data.url.startsWith("data:image/")) return { dataUrl: data.url };
    let parsed: URL;
    try {
      parsed = new URL(data.url);
    } catch {
      throw new Error("Endereço de imagem inválido.");
    }
    if (parsed.protocol !== "https:") throw new Error("Só aceitamos imagens em endereços seguros (https).");

    const res = await fetch(parsed.toString());
    if (!res.ok) throw new Error("Não conseguimos baixar essa imagem. Tente outra.");
    const type = res.headers.get("content-type") ?? "image/jpeg";
    if (!type.startsWith("image/")) throw new Error("O endereço não aponta para uma imagem.");
    const buffer = await res.arrayBuffer();
    if (buffer.byteLength > 4_000_000) throw new Error("Essa imagem é muito grande. Escolha outra.");
    const base64 = Buffer.from(buffer).toString("base64");
    return { dataUrl: `data:${type};base64,${base64}` };
  });

/** Guarda o produto na biblioteca para reutilizar a imagem na próxima vez. */
export const rememberProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      products: Array<{
        name: string;
        brand?: string;
        size?: string;
        category?: string;
        price?: number;
        imageUrl?: string | null;
        imageSource?: string | null;
      }>;
    }) =>
      z
        .object({
          products: z
            .array(
              z.object({
                name: z.string().min(1).max(160),
                brand: z.string().max(80).optional(),
                size: z.string().max(60).optional(),
                category: z.string().max(60).optional(),
                price: z.number().optional(),
                imageUrl: z.string().nullable().optional(),
                imageSource: z.string().nullable().optional(),
              }),
            )
            .max(60),
        })
        .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    for (const product of data.products) {
      try {
        const { data: existing } = await supabase
          .from("products")
          .select("id, times_used")
          .eq("user_id", userId)
          .eq("name", product.name)
          .eq("brand", product.brand ?? "")
          .maybeSingle();

        if (existing) {
          await supabase
            .from("products")
            .update({
              size: product.size ?? "",
              category: product.category ?? null,
              last_price: product.price ?? null,
              image_url: product.imageUrl ?? undefined,
              image_source: product.imageSource ?? undefined,
              times_used: (existing.times_used ?? 0) + 1,
            })
            .eq("id", existing.id);
        } else {
          await supabase.from("products").insert({
            user_id: userId,
            name: product.name,
            brand: product.brand ?? "",
            size: product.size ?? "",
            category: product.category ?? null,
            last_price: product.price ?? null,
            image_url: product.imageUrl ?? null,
            image_source: product.imageSource ?? null,
            times_used: 1,
          });
        }
      } catch (error) {
        console.error("remember product failed", error);
      }
    }
    return { ok: true };
  });
