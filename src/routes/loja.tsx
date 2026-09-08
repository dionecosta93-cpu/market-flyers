import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ImagePlus, Loader2, Save, Sparkles, Store, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AuthView, useAuthSession } from "@/components/auth-view";
import { generateStoreLogo } from "@/lib/ai.functions";
import {
  EMPTY_STORE_PROFILE,
  fetchStoreProfile,
  saveStoreProfile,
  type StoreProfile,
} from "@/lib/store-profile";

export const Route = createFileRoute("/loja")({
  component: StorePage,
  head: () => ({
    meta: [
      { title: "Dados do meu mercado | Market Flyers" },
      {
        name: "description",
        content:
          "Cadastre logo, nome, telefone, WhatsApp, endereço e Instagram do seu mercado para aparecerem automaticamente nos encartes.",
      },
      { property: "og:title", content: "Dados do meu mercado | Market Flyers" },
      {
        property: "og:description",
        content: "Salve os dados do mercado uma vez e use em todos os encartes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const MAX_LOGO_BYTES = 3 * 1024 * 1024;

function StorePage() {
  const navigate = useNavigate();
  const { session, authLoading } = useAuthSession();
  const userId = session?.user.id;

  const [profile, setProfile] = useState<StoreProfile>({ ...EMPTY_STORE_PROFILE });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchStoreProfile(userId)
      .then((data) => {
        if (!cancelled) setProfile(data);
      })
      .then(undefined, () => {
        if (!cancelled) setMessage({ type: "err", text: "Não foi possível carregar seus dados." });
      })
      .then(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  function set<K extends keyof StoreProfile>(key: K, value: StoreProfile[K]) {
    setProfile((prev) => ({ ...prev, [key]: value }));
    setMessage(null);
  }

  function handleLogoFile(file: File | null | undefined) {
    if (!file) return;
    if (!/^image\/(png|jpeg|jpg|webp)$/i.test(file.type)) {
      setMessage({ type: "err", text: "Envie a logo em PNG, JPG ou WEBP." });
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setMessage({ type: "err", text: "A logo deve ter no máximo 3 MB." });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => set("logo_url", String(reader.result || ""));
    reader.onerror = () => setMessage({ type: "err", text: "Não foi possível ler a imagem." });
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    if (!userId) return;
    setSaving(true);
    setMessage(null);
    const error = await saveStoreProfile(userId, profile);
    setSaving(false);
    setMessage(
      error
        ? { type: "err", text: "Não foi possível salvar. Tente novamente." }
        : {
            type: "ok",
            text: "Dados salvos. Eles vão aparecer automaticamente nos próximos encartes.",
          },
    );
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session) return <AuthView />;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-gradient-to-br from-[#d91a1a] via-[#b91c1c] to-[#991b1b] text-white">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-white hover:bg-white/15 hover:text-white -ml-2 mb-4"
            onClick={() => navigate({ to: "/flyers" })}
          >
            <ChevronLeft className="w-4 h-4" />
            Voltar
          </Button>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <Store className="w-6 h-6" />
            DADOS DO MEU MERCADO
          </h1>
          <p className="text-white/80 text-sm mt-2">
            Cadastre uma vez. Esses dados entram sozinhos em todos os seus encartes.
          </p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Card>
            <CardContent className="p-5 sm:p-6 space-y-6">
              <div className="space-y-3">
                <Label>Logo do mercado</Label>
                <div className="flex items-center gap-4">
                  <div className="w-24 h-24 rounded-xl border-2 border-dashed border-border bg-muted/40 flex items-center justify-center overflow-hidden shrink-0">
                    {profile.logo_url ? (
                      <img
                        src={profile.logo_url}
                        alt="Logo do mercado"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <ImagePlus className="w-7 h-7 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => fileRef.current?.click()}
                    >
                      <ImagePlus className="w-4 h-4" />
                      {profile.logo_url ? "Trocar logo" : "Enviar logo"}
                    </Button>
                    {profile.logo_url && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-destructive hover:text-destructive"
                        onClick={() => set("logo_url", null)}
                      >
                        <Trash2 className="w-4 h-4" />
                        Remover
                      </Button>
                    )}
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => handleLogoFile(e.target.files?.[0])}
                  />
                </div>
                <p className="text-xs text-muted-foreground">PNG, JPG ou WEBP até 3 MB.</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="store_name">Nome do mercado</Label>
                  <Input
                    id="store_name"
                    value={profile.store_name}
                    onChange={(e) => set("store_name", e.target.value)}
                    placeholder="Mercado Oeste"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={profile.phone}
                    onChange={(e) => set("phone", e.target.value)}
                    placeholder="(49) 99999-9999"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="whatsapp">WhatsApp</Label>
                  <Input
                    id="whatsapp"
                    value={profile.whatsapp}
                    onChange={(e) => set("whatsapp", e.target.value)}
                    placeholder="(49) 99999-9999"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="address">Endereço</Label>
                  <Input
                    id="address"
                    value={profile.address}
                    onChange={(e) => set("address", e.target.value)}
                    placeholder="Rua Principal, 100 — Centro"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="instagram">Instagram</Label>
                  <Input
                    id="instagram"
                    value={profile.instagram}
                    onChange={(e) => set("instagram", e.target.value)}
                    placeholder="@mercadooeste"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="footer_text">Texto do rodapé</Label>
                  <Textarea
                    id="footer_text"
                    value={profile.footer_text}
                    onChange={(e) => set("footer_text", e.target.value)}
                    rows={2}
                    className="resize-none"
                    placeholder="Ofertas válidas enquanto durarem os estoques."
                  />
                </div>
              </div>

              {message && (
                <p
                  className={
                    message.type === "err"
                      ? "rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
                      : "rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary"
                  }
                >
                  {message.text}
                </p>
              )}

              <Button className="w-full gap-2 h-11" onClick={handleSave} disabled={saving}>
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Salvar dados do mercado
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
