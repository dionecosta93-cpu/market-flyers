import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, ShoppingBag, MoreHorizontal, Pencil, Trash2, Copy } from "lucide-react";
import { formatById } from "@/lib/flyer-types";

const MOCK_FLYERS = [
  {
    id: "1",
    title: "Encarte Semana 01-09",
    template: "default",
    format: "ig_feed",
    status: "published",
    is_paid: false,
    download_count: 142,
    created_at: "2026-09-01T10:00:00Z",
    pages_count: 2,
  },
  {
    id: "2",
    title: "Promo Fim de Semana",
    template: "default",
    format: "whatsapp",
    status: "draft",
    is_paid: false,
    download_count: 0,
    created_at: "2026-09-03T14:30:00Z",
    pages_count: 1,
  },
];

export const Route = createFileRoute("/flyers")({
  component: FlyersPage,
});

function FlyersPage() {
  const [search, setSearch] = useState("");

  const filtered = MOCK_FLYERS.filter((f) =>
    f.title.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: "#fcfbf8" }}
    >
      {/* Header */}
      <header className="bg-white border-b border-border sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">Market Flyers</h1>
              <p className="text-xs text-muted-foreground">Crie encartes profissionais</p>
            </div>
          </div>
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            Novo Encarte
          </Button>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Search & Filters */}
        <div className="flex items-center gap-4 mb-6">
          <Input
            placeholder="Buscar encartes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
        </div>

        {/* Flyers Grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <ShoppingBag className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              {search ? "Nenhum encarte encontrado" : "Nenhum encarte ainda"}
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              {search
                ? "Tente buscar por outro termo"
                : "Comece criando seu primeiro encarte de ofertas"}
            </p>
            {!search && (
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Criar Encarte
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((flyer) => (
              <Card key={flyer.id} className="group cursor-pointer hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  {/* Preview placeholder */}
                  <div className="aspect-[3/4] rounded-lg bg-muted mb-4 flex items-center justify-center relative overflow-hidden">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-muted-foreground/30">
                        {flyer.pages_count} {flyer.pages_count === 1 ? "página" : "páginas"}
                      </p>
                      <p className="text-xs text-muted-foreground/30 mt-1">
                        {formatById(flyer.format).label}
                      </p>
                    </div>
                    <div className="absolute top-2 right-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="space-y-1">
                    <h3 className="font-medium text-foreground truncate">{flyer.title}</h3>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{formatById(flyer.format).label}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${
                        flyer.status === "published"
                          ? "bg-green-100 text-green-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}>
                        {flyer.status === "published" ? "Publicado" : "Rascunho"}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 mt-4 pt-4 border-t border-border opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="sm" className="gap-1 flex-1">
                      <Pencil className="w-3 h-3" />
                      Editar
                    </Button>
                    <Button variant="ghost" size="sm" className="gap-1 flex-1">
                      <Copy className="w-3 h-3" />
                      Duplicar
                    </Button>
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
