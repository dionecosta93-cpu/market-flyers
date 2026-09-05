import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const OPENAI_API_URL = "https://api.openai.com/v1";
const TEXT_MODEL = "gpt-4.1-mini";
const TRANSCRIPTION_MODEL = "gpt-4o-mini-transcribe";
const IMAGE_MODEL = "gpt-image-1";

type GatewayError = { status: number; message: string };
type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value !== null && typeof value === "object" ? (value as UnknownRecord) : {};
}

async function gateway(path: string, body: unknown): Promise<unknown> {
  const key = process.env["OPENAI_API_KEY"];
  if (!key) throw new Error("A IA não está configurada neste projeto (OPENAI_API_KEY ausente).");
  const res = await fetch(`${OPENAI_API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try {
      const parsed = JSON.parse(text) as { error?: { message?: string }; message?: string };
      message = parsed.error?.message ?? parsed.message ?? text;
    } catch {
      /* keep raw text */
    }
    const err: GatewayError = { status: res.status, message };
    if (res.status === 429)
      throw new Error("A IA está recebendo muitos pedidos. Tente novamente em alguns segundos.");
    if (res.status === 402) throw new Error(`Créditos da OpenAI insuficientes: ${message}`);
    if (res.status === 403) throw new Error(`A OpenAI bloqueou esta solicitação: ${message}`);
    throw new Error(`Falha na OpenAI (${err.status}): ${err.message}`);
  }
  return res.json();
}

async function transcribeAudio(audioBase64: string, format: string): Promise<string> {
  const key = process.env["OPENAI_API_KEY"];
  if (!key) throw new Error("A IA não está configurada neste projeto (OPENAI_API_KEY ausente).");

  const audio = Uint8Array.from(atob(audioBase64), (character) => character.charCodeAt(0));
  const form = new FormData();
  form.append("model", TRANSCRIPTION_MODEL);
  form.append("language", "pt");
  form.append("file", new Blob([audio], { type: `audio/${format}` }), `ofertas.${format}`);

  const res = await fetch(`${OPENAI_API_URL}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!res.ok) {
    const message = await res.text();
    throw new Error(`Falha na transcrição da OpenAI (${res.status}): ${message}`);
  }

  const text = asRecord(await res.json()).text;
  return typeof text === "string" ? text : "";
}

async function logUsage(userId: string, kind: string, meta: Record<string, unknown> = {}) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("ai_usage").insert({ user_id: userId, kind, meta });
  } catch (error) {
    console.error("ai_usage log failed", error);
  }
}

function firstText(json: unknown): string {
  const choices = asRecord(json).choices;
  if (!Array.isArray(choices)) return "";
  const message = asRecord(choices[0]).message;
  const content = asRecord(message).content;
  return typeof content === "string" ? content : "";
}

function extractJson(raw: string): unknown {
  const cleaned = raw
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error("Não foi possível interpretar a resposta da IA.");
  }
}

/** Audio (base64) -> transcript */
export const transcribeOffers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { audioBase64: string; format: string }) =>
    z.object({ audioBase64: z.string().min(10), format: z.string().min(2) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const text = (await transcribeAudio(data.audioBase64, data.format)).trim();
    await logUsage(context.userId, "transcricao", { chars: text.length });
    return { text };
  });

const OFFER_INSTRUCTIONS = `Você é especialista em encartes de supermercado no Brasil.
Receba um texto (falado ou digitado, possivelmente sem pontuação) e extraia as ofertas.
Converta preços falados: "oito e noventa e nove" = 8.99, "sete e trinta e nove" = 7.39, "cinco reais" = 5.00.
Para cada produto retorne:
- name: nome do produto sem a marca (ex: "Arroz", "Feijão Preto", "Óleo de Soja")
- brand: marca quando identificada, senão ""
- size: peso/volume como texto curto (ex: "5 kg", "900 ml", "1 kg"), senão ""
- price: número decimal do preço atual
- oldPrice: preço anterior se informado, senão null
- category: uma de "Mercearia","Bebidas","Carnes","Hortifruti","Frios e Laticínios","Limpeza","Higiene","Padaria","Congelados","Outros"
- qty: quantidade/limite se informada (ex: "2 unidades por cliente"), senão ""
- confident: true/false — false quando você não teve certeza do produto ou do preço
Responda APENAS com JSON: {"products":[...]}. Se nada for identificável, {"products":[]}.`;

export const parseOffers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { text: string }) =>
    z.object({ text: z.string().min(2).max(8000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const json = await gateway("/chat/completions", {
      model: TEXT_MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: OFFER_INSTRUCTIONS },
        { role: "user", content: data.text },
      ],
    });
    const parsed = asRecord(extractJson(firstText(json)));
    const products = Array.isArray(parsed.products) ? parsed.products : [];
    await logUsage(context.userId, "interpretacao", { count: products.length });
    return {
      products: products.map((value) => {
        const p = asRecord(value);
        return {
          name: String(p?.name ?? "").trim() || "Produto",
          brand: String(p?.brand ?? "").trim(),
          size: String(p?.size ?? "").trim(),
          price: Number(p?.price ?? 0) || 0,
          oldPrice: p?.oldPrice == null ? null : Number(p.oldPrice) || null,
          category: String(p?.category ?? "Outros").trim(),
          qty: String(p?.qty ?? "").trim(),
          confident: p.confident !== false,
        };
      }),
    };
  });

/** Voice/text correction over an existing product list */
export const correctOffers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { command: string; products: unknown }) =>
    z.object({ command: z.string().min(2).max(2000), products: z.any() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const json = await gateway("/chat/completions", {
      model: TEXT_MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Você edita uma lista de ofertas de encarte. Receba a lista atual (JSON) e um comando em português.
Aplique somente o que o comando pede (corrigir nome, marca, peso, preço, remover ou adicionar produto).
Mantenha o campo "id" de cada produto existente. Responda APENAS JSON: {"products":[...]} com a lista completa atualizada.`,
        },
        {
          role: "user",
          content: `Lista atual:\n${JSON.stringify(data.products)}\n\nComando: ${data.command}`,
        },
      ],
    });
    const parsed = asRecord(extractJson(firstText(json)));
    await logUsage(context.userId, "correcao", {});
    return { products: Array.isArray(parsed.products) ? parsed.products : [] };
  });

/** AI layout organisation: returns ordered ids + highlights + suggested per_page */
export const organizeFlyer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { products: unknown; perPage: number }) =>
    z.object({ products: z.any(), perPage: z.number().min(1).max(20) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const json = await gateway("/chat/completions", {
      model: TEXT_MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Você é diretor de arte de encartes de supermercado. Receba produtos com id, nome, marca, peso e preço.
Organize para equilíbrio visual: agrupe por categoria, alterne nomes longos e curtos, e destaque de 1 a 2 produtos com melhor apelo de preço.
Responda APENAS JSON: {"order":["id",...],"highlight":["id",...],"headline":"chamada curta em maiúsculas","subheadline":"texto curto"}`,
        },
        {
          role: "user",
          content: JSON.stringify({ products: data.products, perPage: data.perPage }),
        },
      ],
    });
    const parsed = asRecord(extractJson(firstText(json)));
    await logUsage(context.userId, "organizacao", {});
    return {
      order: Array.isArray(parsed.order) ? parsed.order.map(String) : [],
      highlight: Array.isArray(parsed.highlight) ? parsed.highlight.map(String) : [],
      headline: typeof parsed.headline === "string" ? parsed.headline : "",
      subheadline: typeof parsed.subheadline === "string" ? parsed.subheadline : "",
    };
  });

/** Generates a clean product image for flyer composition. Returns a data URL. */
export const generateProductImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { name: string; brand?: string; size?: string; category?: string }) =>
    z
      .object({
        name: z.string().min(1).max(120),
        brand: z.string().max(80).optional(),
        size: z.string().max(40).optional(),
        category: z.string().max(60).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const descriptor = [data.name, data.size, data.category].filter(Boolean).join(", ");
    const prompt = `Foto de produto de supermercado para encarte promocional: ${descriptor}.
Produto genérico, sem logotipos, sem marcas registradas e sem texto legível na embalagem.
Fundo branco puro, iluminação de estúdio, produto centralizado e completo, alta nitidez, estilo catálogo.`;
    const json = await gateway("/images/generations", {
      model: IMAGE_MODEL,
      prompt,
      size: "1024x1024",
      quality: "medium",
    });
    const images = asRecord(json).data;
    const firstImage = Array.isArray(images) ? asRecord(images[0]) : {};
    const b64Json = firstImage.b64_json;
    const url = typeof b64Json === "string" ? `data:image/png;base64,${b64Json}` : undefined;
    if (!url) throw new Error("A IA não retornou uma imagem para este produto.");
    await logUsage(context.userId, "imagem", { product: data.name });
    return { dataUrl: url };
  });
