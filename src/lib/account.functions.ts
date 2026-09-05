import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** E-mail do proprietário do sistema — recebe a função de administrador no backend. */
const ADMIN_EMAILS = ["dionecosta93@gmail.com"];

/**
 * Garante que o usuário logado tenha perfil e função.
 * A função de admin é atribuída no servidor (nunca no frontend).
 */
export const ensureAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;
    const email = (context.claims as { email?: string } | undefined)?.email ?? null;
    const meta = (
      context.claims as { user_metadata?: { full_name?: string; name?: string } } | undefined
    )?.user_metadata;

    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name")
      .eq("id", userId)
      .maybeSingle();

    if (!existing) {
      await supabaseAdmin.from("profiles").insert({
        id: userId,
        email,
        full_name: meta?.full_name ?? meta?.name ?? null,
      });
    } else if (email && !existing.full_name && (meta?.full_name || meta?.name)) {
      await supabaseAdmin
        .from("profiles")
        .update({ full_name: meta?.full_name ?? meta?.name ?? null })
        .eq("id", userId);
    }

    const isAdmin = !!email && ADMIN_EMAILS.includes(email.toLowerCase());
    const role = isAdmin ? "admin" : "user";
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role }, { onConflict: "user_id,role" });

    return { isAdmin };
  });
