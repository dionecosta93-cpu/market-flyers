import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { ImageCandidate } from "@/lib/images.functions";

type AiProviderConfig = {
  provider: "openai" | "lovable";
  apiKey: string;
  model: string;
  imageModel: string;
  visionModel: string;
};

function getAiConfig(): AiProviderConfig {
  const openAiKey = process.env["OPENAI_API_KEY"]?.trim();
  const lovableKey = process.env["LOVABLE_API_KEY"]?.trim();

  if (openAiKey) {
    return {
      provider: "openai",
      apiKey: openAiKey,
      model: process.env["OPENAI_MODEL"]?.trim() || "gpt-4o-mini",
      imageModel: process.env["OPENAI_IMAGE_MODEL"]?.trim() || "dall-e-3",
      visionModel: process.env["OPENAI_VISION_MODEL"]?.trim() || "gpt-4o",
    };
  }

  if (lovableKey) {
    return {
      provider: "lovable",
      apiKey: lovableKey,
      model: "google/gemini-3.7-flash",
      imageModel: "google/gemini-3.1-flash-image",
      visionModel: "google/gemini-3.7-flash",
    };
  }

  throw new Error(
    "A IA não está configurada neste projeto. Configure a variável OPENAI_API_KEY no arquivo .env para ativar a criação com IA da OpenAI.",
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function firstText(json: any): string {
  return json?.choices?.[0]?.message?.content ?? "";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractJson(raw: string): any {
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
    throw new Error("Não foi possível interpretar a resposta estruturada da IA.");
  }
}

async function logUsage(userId: string, kind: string, meta: Record<string, unknown> = {}) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("ai_usage").insert({ user_id: userId, kind, meta: meta as never });
  } catch (error) {
    console.error("ai_usage log failed", error);
  }
}

/** Executa chamada de Chat Completion (OpenAI ou gateway compatível) */
async function callChat(params: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  messages: Array<{ role: string; content: any }>;
  jsonMode?: boolean;
}): Promise<string> {
  const config = getAiConfig();

  const baseUrl =
    config.provider === "openai"
      ? "https://api.openai.com/v1"
      : "https://ai.gateway.lovable.dev/v1";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: Record<string, any> = {
    model: config.model,
    messages: params.messages,
  };

  if (params.jsonMode) {
    payload["response_format"] = { type: "json_object" };
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try {
      const parsed = JSON.parse(text);
      message = parsed?.error?.message || parsed?.message || text;
    } catch {
      /* texto bruto */
    }

    if (res.status === 401) {
      throw new Error(
        "Chave de API inválida ou não autorizada. Verifique sua OPENAI_API_KEY no arquivo .env.",
      );
    }
    if (res.status === 429) {
      throw new Error(
        "Limite de requisições ou créditos da OpenAI esgotados. Verifique seu saldo na plataforma da OpenAI.",
      );
    }
    if (res.status === 402) {
      throw new Error(`Créditos de IA insuficientes: ${message}`);
    }
    throw new Error(`Erro na chamada da IA (${res.status}): ${message}`);
  }

  const json = await res.json();
  return firstText(json);
}

/** Pesquisa real na internet usando OpenAI Responses API com web_search */
async function searchProductImageOnWeb(params: {
  name: string;
  brand?: string;
  size?: string;
}): Promise<ImageCandidate[]> {
  const config = getAiConfig();

  if (config.provider !== "openai") {
    return [];
  }

  const query = [params.brand, params.name, params.size, "embalagem original"]
    .filter(Boolean)
    .join(" ");

  const body: Record<string, unknown> = {
    model: "gpt-4o",
    tools: [{ type: "web_search" }],
    input: `Encontre uma imagem REAL da embalagem original deste produto de supermercado: ${query}. Procure URLs diretas de imagens (.jpg, .jpeg, .png, .webp) em sites oficiais, grandes supermercados ou distribuidores. Responda APENAS um JSON com até 5 imagens: [{"url":"https://...","source":"site","title":"descricao","confidence":0.9}]`,
    max_output_tokens: 600,
  };

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`web_search failed (${res.status}): ${text}`);
    return [];
  }

  const json = await res.json();
  const raw = json?.output_text ?? json?.text ?? firstText(json);

  const cleaned = String(raw)
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();

  let parsed: Array<{ url?: string; source?: string; title?: string; confidence?: number }> = [];
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    console.error("web_search json parse failed", cleaned.slice(0, 200));
    return [];
  }

  const items = parsed
    .filter((item) => typeof item.url === "string" && /^https?:\/\//i.test(item.url))
    .map((item) => ({
      url: String(item.url),
      title: String(item.title ?? query),
      source: String(item.source ?? "Web"),
      sourceUrl: String(item.url),
      score: Number(item.confidence ?? 0.7) * 100,
    }))
    .slice(0, 5);

  console.log(`web_search results for "${query}":`, items.length, items.map((i) => i.url));
  return items;
}

export { searchProductImageOnWeb };

async function callAudioTranscription(audioBase64: string, format: string): Promise<string> {
  const config = getAiConfig();

  if (config.provider === "openai") {
    const buffer = Buffer.from(audioBase64, "base64");
    const mimeType = format.includes("mp4") ? "audio/mp4" : "audio/webm";
    const ext = format.includes("mp4") ? "mp4" : "webm";
    const blob = new Blob([buffer], { type: mimeType });

    const formData = new FormData();
    formData.append("file", blob, `audio.${ext}`);
    formData.append("model", "whisper-1");
    formData.append("language", "pt");
    formData.append("prompt", "Ofertas de supermercado com produtos, marcas e preços em reais.");

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: formData,
    });

    if (!res.ok) {
      const text = await res.text();
      let message = text;
      try {
        const parsed = JSON.parse(text);
        message = parsed?.error?.message || text;
      } catch {
        /* raw text */
      }
      throw new Error(`Erro no Whisper da OpenAI (${res.status}): ${message}`);
    }

    const json = await res.json();
    return String(json?.text ?? "").trim();
  } else {
    // Gateway Lovable com modalidade de áudio
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          {
            role: "system",
            content:
              "Você transcreve áudio em português do Brasil. Devolva SOMENTE a transcrição literal, sem comentários.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Transcreva este áudio de ofertas de supermercado." },
              { type: "input_audio", input_audio: { data: audioBase64, format } },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Falha na transcrição: ${text}`);
    }

    const json = await res.json();
    return firstText(json).trim();
  }
}

/** Geração de imagem com DALL-E 3 da OpenAI */
async function callImageGeneration(prompt: string): Promise<string> {
  const config = getAiConfig();

  if (config.provider === "openai") {
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.imageModel,
        prompt: prompt,
        n: 1,
        size: "1024x1024",
        response_format: "b64_json",
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      let message = text;
      try {
        const parsed = JSON.parse(text);
        message = parsed?.error?.message || text;
      } catch {
        /* raw text */
      }
      throw new Error(`Erro no DALL-E da OpenAI (${res.status}): ${message}`);
    }

    const json = await res.json();
    const b64 = json?.data?.[0]?.b64_json;
    if (b64) {
      return `data:image/png;base64,${b64}`;
    }
    const url = json?.data?.[0]?.url;
    if (url) {
      return url;
    }
    throw new Error("A OpenAI não retornou uma imagem para este produto.");
  } else {
    // Gateway Lovable
    const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.imageModel,
        messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
        modalities: ["image", "text"],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Falha na IA (${res.status}): ${text}`);
    }

    const json = await res.json();
    const url: string | undefined =
      json?.choices?.[0]?.message?.images?.[0]?.image_url?.url ??
      (json?.data?.[0]?.b64_json ? `data:image/png;base64,${json.data[0].b64_json}` : undefined);

    if (!url) throw new Error("A IA não retornou uma imagem para este produto.");
    return url;
  }
}

/** Audio (base64) -> transcrição com Whisper / IA */
export const transcribeOffers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { audioBase64: string; format: string }) =>
    z.object({ audioBase64: z.string().min(10), format: z.string().min(2) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const text = await callAudioTranscription(data.audioBase64, data.format);
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

/** Interpretação de texto e extração de ofertas via GPT-4o-mini */
export const parseOffers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { text: string }) =>
    z.object({ text: z.string().min(2).max(8000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const raw = await callChat({
      messages: [
        { role: "system", content: OFFER_INSTRUCTIONS },
        { role: "user", content: data.text },
      ],
      jsonMode: true,
    });

    const parsed = extractJson(raw);
    const products = Array.isArray(parsed?.products) ? parsed.products : [];
    await logUsage(context.userId, "interpretacao", { count: products.length });

    return {
      products: products.map((p: Record<string, unknown>) => ({
        name: String(p?.['name'] ?? "").trim() || "Produto",
        brand: String(p?.['brand'] ?? "").trim(),
        size: String(p?.['size'] ?? "").trim(),
        price: Number(p?.['price'] ?? 0) || 0,
        oldPrice: p?.['oldPrice'] == null ? null : Number(p['oldPrice']) || null,
        category: String(p?.['category'] ?? "Outros").trim(),
        qty: String(p?.['qty'] ?? "").trim(),
        confident: p?.['confident'] !== false,
      })),
    };
  });

/** Correção e edição de ofertas via comando em linguagem natural */
export const correctOffers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { command: string; products: unknown }) =>
    z.object({ command: z.string().min(2).max(2000), products: z.any() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const raw = await callChat({
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
      jsonMode: true,
    });

    const parsed = extractJson(raw);
    await logUsage(context.userId, "correcao", {});
    return { products: Array.isArray(parsed?.products) ? parsed.products : [] };
  });

/** Organização inteligente de layout de encarte */
export const organizeFlyer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { products: unknown; perPage: number }) =>
    z.object({ products: z.any(), perPage: z.number().min(1).max(20) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const raw = await callChat({
      messages: [
        {
          role: "system",
          content: `Você é um diretor de arte sênior especializado em encartes de supermercado.
Seu trabalho é criar uma composição profissional que pareça feita por uma agência de publicidade.

Produtos recebidos: JSON com id, nome, marca, peso, preço, oldPrice, category, qty, highlight.

DIRETRIZES VISUAIS:
1. PRODUTOS COM MELHOR PREÇO recebem destaque máximo: imagem maior, preço gigante em etiqueta promocional.
2. Preços devem ser o elemento mais chamativo do encarte, depois as imagens dos produtos.
3. Agrupe produtos por categoria (hortifruti, mercearia, limpeza, etc) para facilitar leitura.
4. Alimente nomes longos com nomes curtos para equilíbrio visual.
5. Se houver 1 produto principal, use layout "destaque + grade". Se houver muitos, use grade equilibrada.
6. Nunca deixe o encarte parecer uma tabela ou catálogo básico. Deve ter impacto comercial.

Responda APENAS JSON:
{
  "order": ["id", "id", ...],
  "highlight": ["id", ...],
  "headline": "chamada principal em maiúsculas",
  "subheadline": "texto secundário",
  "layout": "grade" | "destaque" | "misto"
}`,
        },
        { role: "user", content: JSON.stringify({ products: data.products, perPage: data.perPage }) },
      ],
      jsonMode: true,
    });

    const parsed = extractJson(raw);
    await logUsage(context.userId, "organizacao", {});
    return {
      order: Array.isArray(parsed?.order) ? parsed.order.map(String) : [],
      highlight: Array.isArray(parsed?.highlight) ? parsed.highlight.map(String) : [],
      headline: typeof parsed?.headline === "string" ? parsed.headline : "",
      subheadline: typeof parsed?.subheadline === "string" ? parsed.subheadline : "",
      layout: typeof parsed?.layout === "string" ? parsed.layout : "grade",
    };
  });


/** Verificação final do encarte antes de exportar */
export const verifyFlyer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { products: unknown; headline: string; subheadline: string }) =>
    z.object({
      products: z.any(),
      headline: z.string().max(120),
      subheadline: z.string().max(200),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const raw = await callChat({
      messages: [
        {
          role: "system",
          content: `Você é um revisor sênior de encartes de supermercado.
Receba os dados do encarte e realize uma verificação completa de qualidade.

Verifique:
1. Nomes de produtos estão corretos e sem abreviações estranhas
2. Preços estão corretos e em formato válido
3. Não há produtos duplicados
4. Não há produtos com preço zero ou negativo
5. Não há nomes vazios
6. Há pelo menos 1 produto no encarte
7. Título e subtítulo estão adequados
8. Categorias estão corretas

Responda APENAS JSON: {"issues":[{"severity":"error"|"warning","message":"descrição do problema","productId":"id ou null"}],"approved":true/false}

Se aprovado, approved=true e issues=[].
Se houver problemas, approved=false e liste todos os issues.`,
        },
        { role: "user", content: JSON.stringify({ products: data.products, headline: data.headline, subheadline: data.subheadline }) },
      ],
      jsonMode: true,
    });

    const parsed = extractJson(raw);
    await logUsage(context.userId, "verificacao", {});
    return {
      issues: Array.isArray(parsed?.issues) ? parsed.issues : [],
      approved: parsed?.approved === true,
    };
  });


/** Geração de imagem de produto para encartes com DALL-E 3 */
export const generateProductImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      name: string;
      brand?: string | undefined;
      size?: string | undefined;
      category?: string | undefined;
    }) =>
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

    const dataUrl = await callImageGeneration(prompt);
    await logUsage(context.userId, "imagem", { product: data.name });
    return { dataUrl };
  });

/** Validação visual de imagem de produto usando GPT-4o Vision */
async function validateProductImage(params: {
  imageUrl: string;
  expectedName: string;
  expectedBrand: string;
  expectedSize: string;
}): Promise<{ score: number; matches: boolean; detectedName: string; detectedBrand: string; detectedSize: string; reasoning: string }> {
  const config = getAiConfig();
  const baseUrl =
    config.provider === "openai"
      ? "https://api.openai.com/v1"
      : "https://ai.gateway.lovable.dev/v1";

  const prompt = `Você é um verificador rigoroso de imagens de produtos de supermercado.
Analise a imagem enviada e determine se ela corresponde EXATAMENTE ao produto esperado.

Produto esperado:
- Nome: ${params.expectedName}
- Marca: ${params.expectedBrand || "(não informada)"}
- Tamanho/Peso: ${params.expectedSize || "(não informado)"}

Regras de validação:
1. A marca visível na embalagem deve ser EXATAMENTE a marca esperada. Se a marca esperada for "Pinduca" e a imagem mostrar "Camil", é INCORRETA.
2. O tipo de produto deve corresponder. Se esperado "Feijão Preto" e a imagem mostrar "Feijão Carioca", é INCORRETA.
3. O peso/volume deve corresponder quando visível. Se esperado "5kg" e a imagem mostrar "1kg", é INCORRETA.
4. A imagem deve mostrar a embalagem ORIGINAL do produto, não uma réplica, não uma ilustração, não um desenho.
5. Se houver qualquer dúvida, marque como INCORRETA.

Responda APENAS com JSON:
{
  "score": 0-100,
  "matches": true/false,
  "detectedName": "nome do produto detectado na imagem",
  "detectedBrand": "marca detectada na imagem",
  "detectedSize": "tamanho detectado na imagem",
  "reasoning": "explicação curta da decisão"
}

Seja rigoroso: só marque matches=true se tiver certeza absoluta que é o produto correto.`;

  const body: Record<string, unknown> = {
    model: config.visionModel,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "image_url",
            image_url: params.imageUrl.startsWith("data:") ? { url: params.imageUrl } : { url: params.imageUrl },
          },
        ],
      },
    ],
    max_tokens: 300,
  };

  if (config.provider === "openai") {
    body["response_format"] = { type: "json_object" };
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try {
      const parsed = JSON.parse(text);
      message = parsed?.error?.message || text;
    } catch {
      /* raw text */
    }
    console.error(`Vision validation failed (${res.status}): ${message}`);
    return { score: 0, matches: false, detectedName: "", detectedBrand: "", detectedSize: "", reasoning: `Erro na validação: ${res.status}` };
  }

  const json = await res.json();
  const raw = json?.choices?.[0]?.message?.content ?? "";
  const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    return {
      score: Number(parsed?.score ?? 0),
      matches: parsed?.matches === true,
      detectedName: String(parsed?.detectedName ?? ""),
      detectedBrand: String(parsed?.detectedBrand ?? ""),
      detectedSize: String(parsed?.detectedSize ?? ""),
      reasoning: String(parsed?.reasoning ?? ""),
    };
  } catch {
    return { score: 0, matches: false, detectedName: "", detectedBrand: "", detectedSize: "", reasoning: "Não foi possível interpretar a validação." };
  }
}

export { validateProductImage };
