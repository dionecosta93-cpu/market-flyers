import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Plus,
  ShoppingBag,
  MoreHorizontal,
  Pencil,
  Trash2,
  Copy,
  Loader2,
  LogOut,
  Sparkles,
  Trash,
  AlertTriangle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { AuthView, useAuthSession } from "@/components/auth-view";
import { brl, formatById, newId, type FlyerPage, type FlyerRow } from "@/lib/flyer-types";
import { templateById } from "@/lib/templates";
import { FlyerCreateDialog } from "@/components/flyer-create-dialog";

export const Route = createFileRoute("/flyers")({
  component: FlyersPage,
});

const DEFAULT_TITLE = "Novo encarte";

function FlyerThumb({ flyer }: { flyer: FlyerRow }) {
  const tpl = templateById(flyer.template || "tradicional");
  const firstPage = Array.isArray(flyer.pages) && flyer.pages.length > 0 ? flyer.pages[0] : null;
  const items = (firstPage?.items || []).slice(0, 4);

  return (
    <div
      className="relative w-full h-full overflow-hidden"
      style={{ backgroundColor: tpl.bg }}
    >
      <div className="px-3 py-2" style={{ backgroundColor: tpl.header, color: tpl.headerText }}>
        <p className="text-sm font-bold leading-tight truncate">
          {(flyer.settings as { headline?: string })?.headline || flyer.title}
        </p>
      </div>

      {items.length > 0 ? (
        <div className="p-3 grid grid-cols-2 gap-2">
          {items.map((offer) => (
            <div
              key={offer.id}
              className="border rounded-lg p-2 flex flex-col min-h-0"
              style={{
                backgroundColor: tpl.card,
                borderColor: tpl.cardBorder,
                color: tpl.cardText,
              }}
            >
              <p
                className="text-[11px] leading-tight font-medium truncate"
                style={{ fontWeight: 700 }}
              >
                {offer.name}
              </p>
              {offer.brand && (
                <p className="text-[8px] leading-tight opacity-70 truncate">{offer.brand}</p>
              )}
              {offer.size && (
                <p className="text-[8px] leading-tight opacity-60 truncate">{offer.size}</p>
              )}
              <div className="mt-auto pt-1">
                <span
                  className="inline-block rounded px-1.5 py-0.5 text-[10px] font-extrabold"
                  style={{ backgroundColor: tpl.price, color: tpl.priceText }}
                >
                  {brl(offer.price || 0)}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center h-2/3">
          <p
            className="text-xs font-medium"
            style={{ color: tpl.headerText }}
          >
            Sem ofertas ainda
          </p>
        </div>
      )}
    </div>
  );
}

function FlyersPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { session, authLoading } = useAuthSession();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);

  const userId = session?.user.id;

  const {
    data: flyers = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["flyers", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("flyers")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as FlyerRow[];
    },
    enabled: !!session,
  });

  async function handleCreate() {
    if (!session) return;
    const { data, error } = await supabase
      .from("flyers")
      .insert({
        user_id: session.user.id,
        title: DEFAULT_TITLE,
        template: "tradicional",
        format: "ig_feed",
        per_page: 8,
        pages: [{ id: newId(), items: [] }] as any,
        settings: {
          storeName: "",
          headline: "OFERTAS DA SEMANA",
          subheadline: "Aproveite os melhores preços",
          validity: "",
          fontScale: 1,
          showFooter: true,
        } as any,
        status: "rascunho",
      })
      .select("id")
      .single();

    if (error) {
      console.error(error);
      return;
    }

    navigate({ to: "/flyers/$flyerId", params: { flyerId: data.id } });
  }

  async function handleDuplicate(flyer: FlyerRow) {
    if (!session) return;
    const { data: original } = await supabase
      .from("flyers")
      .select("*")
      .eq("id", flyer.id)
      .single();
    if (!original) return;

    await supabase.from("flyers").insert({
      user_id: session.user.id,
      title: `${original.title || DEFAULT_TITLE} (cópia)`,
      template: original.template || "tradicional",
      format: original.format || "ig_feed",
      per_page: original.per_page ?? 8,
      pages: original.pages,
      settings: original.settings,
      status: "rascunho",
    });

    queryClient.invalidateQueries({ queryKey: ["flyers", userId] });
  }

  async function handleDelete(flyer: FlyerRow) {
    if (!session) return;
    if (!window.confirm(`Excluir o encarte "${flyer.title}"?`)) return;

    await supabase.from("flyers").delete().eq("id", flyer.id);
    queryClient.invalidateQueries({ queryKey: ["flyers", userId] });
  }

  async function handleDeleteAll() {
    if (!session) return;
    setDeletingAll(true);
    try {
      await supabase.from("flyers").delete().eq("user_id", session.user.id);
      queryClient.invalidateQueries({ queryKey: ["flyers", userId] });
      setDeleteAllOpen(false);
    } finally {
      setDeletingAll(false);
    }
  }

  function handleCreated(flyerId: string) {
    queryClient.invalidateQueries({ queryKey: ["flyers", userId] });
    navigate({ to: "/flyers/$flyerId", params: { flyerId } });
  }

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session) {
    return <AuthView />;
  }

  const filtered = flyers.filter((f) =>
    String(f.title || "")
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-background border-b border-border sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shrink-0">
              <ShoppingBag className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-foreground truncate">Market Flyers</h1>
              <p className="text-xs text-muted-foreground truncate">
                {session.user.email || "Crie encartes profissionais"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {flyers.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 text-destructive hover:text-destructive"
                onClick={() => setDeleteAllOpen(true)}
              >
                <Trash className="w-4 h-4" />
                Excluir tudo
              </Button>
            )}
            <Button variant="ghost" size="sm" className="gap-2" onClick={handleLogout}>
              <LogOut className="w-4 h-4" />
              Sair
            </Button>
            <Button className="gap-2" onClick={() => setCreateOpen(true)}>
              <Sparkles className="w-4 h-4" />
              Novo Encarte
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between gap-4 mb-6">
          <Input
            placeholder="Buscar encartes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <p className="text-sm text-muted-foreground shrink-0">
          {flyers.length} {flyers.length === 1 ? "encarte" : "encartes"}
        </p>
        {flyers.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-destructive border-destructive/30 hover:text-destructive"
            onClick={() => setDeleteAllOpen(true)}
          >
            <Trash className="w-3.5 h-3.5" />
            Excluir todos
          </Button>
        )}
        </div>

        {error && (
          <div className="rounded-lg bg-destructive/10 text-destructive px-4 py-3 text-sm mb-6">
            Não foi possível carregar seus encartes. Verifique sua conexão e tente novamente.
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <ShoppingBag className="w-7 h-7 text-muted-foreground/60" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">
              {search ? "Nenhum encarte encontrado" : "Nenhum encarte ainda"}
            </h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
              {search
                ? "Tente buscar por outro termo"
                : "Use a IA para montar encartes profissionais em poucos minutos."}
            </p>
            <Button className="gap-2" onClick={handleCreate}>
              <Sparkles className="w-4 h-4" />
              Criar primeiro encarte
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((flyer) => {
              const fmt = formatById(flyer.format || "ig_feed");
              const pagesCount = Array.isArray(flyer.pages) ? flyer.pages.length : 0;
              const createdAt = new Date(flyer.created_at);

              return (
                <Card
                  key={flyer.id}
                  className="group cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() =>
                    navigate({
                      to: "/flyers/$flyerId",
                      params: { flyerId: flyer.id },
                    })
                  }
                >
                  <CardContent className="p-3">
                    <div className="aspect-[3/4] rounded-lg overflow-hidden bg-muted mb-3 relative">
                      <FlyerThumb flyer={flyer} />
                      <div className="absolute top-2 right-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 bg-background/80 backdrop-blur"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    <h3 className="font-medium text-foreground truncate">{flyer.title}</h3>
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground mt-1">
                      <span>
                        {fmt.label} · {pagesCount || 1}{" "}
                        {pagesCount === 1 ? "página" : "páginas"}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full ${
                          flyer.status === "published"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {flyer.status === "published" ? "Publicado" : "Rascunho"}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                      {createdAt.toLocaleDateString("pt-BR")}
                    </p>

                    <div className="flex items-center gap-1 mt-3 pt-3 border-t border-border group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 flex-1 text-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate({
                            to: "/flyers/$flyerId",
                            params: { flyerId: flyer.id },
                          });
                        }}
                      >
                        <Pencil className="w-3 h-3" />
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 flex-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDuplicate(flyer);
                        }}
                      >
                        <Copy className="w-3 h-3" />
                        Duplicar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(flyer);
                        }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
        <Dialog open={deleteAllOpen} onOpenChange={setDeleteAllOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-5 h-5" />
                Excluir todos os encartes
              </DialogTitle>
              <DialogDescription>
                Tem certeza que deseja excluir os {flyers.length} encarte{flyers.length > 1 ? 's' : ''}? Esta ação não pode ser desfeita.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setDeleteAllOpen(false)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteAll}
                disabled={deletingAll}
                className="gap-1.5"
              >
                {deletingAll && <Loader2 className="w-4 h-4 animate-spin" />}
                <Trash className="w-4 h-4" />
                {deletingAll ? 'Excluindo...' : 'Excluir todos'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <FlyerCreateDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          userId={userId || ''}
          onCreated={handleCreated}
        />
      </main>
    </div>
  );
}
