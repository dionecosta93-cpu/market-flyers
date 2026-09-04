import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  ShoppingBag,
  Plus,
  Trash2,
  ChevronLeft,
  Eye,
  Download,
  Image,
  Star,
  GripVertical,
  Settings,
  Type,
  Store,
} from "lucide-react";
import type { Offer, FlyerSettings } from "@/lib/flyer-types";
import { brl, formatById } from "@/lib/flyer-types";

const MOCK_OFFERS: Offer[] = [
  { id: "1", name: "Arroz 5kg", brand: "Tio João", price: 22.90, oldPrice: 26.90, highlight: true },
  { id: "2", name: "Feijão 1kg", brand: "Camil", price: 8.90, oldPrice: 10.90, highlight: false },
  { id: "3", name: "Óleo de Soja 900ml", brand: "Liza", price: 7.49, highlight: true },
  { id: "4", name: "Açúcar 1kg", price: 5.90, highlight: false },
];

const DEFAULT_SETTINGS: FlyerSettings = {
  storeName: "Super Mercado",
  headline: "COMBO DA SEMANA",
  subheadline: "Ofertas válidas até 30/09",
  validity: "Válido até 30 de Setembro de 2026",
  address: "Rua das Flores, 100 - Centro",
  phone: "(11) 99999-9999",
  whatsapp: "(11) 99999-9999",
  instagram: "@supermercado",
  showFooter: true,
  fontScale: 1,
};

export const Route = createFileRoute("/flyers/$flyerId")({
  component: FlyerEditorPage,
});

function FlyerEditorPage() {
  const { flyerId } = Route.useParams();
  const [offers, setOffers] = useState<Offer[]>(MOCK_OFFERS);
  const [settings, setSettings] = useState<FlyerSettings>(DEFAULT_SETTINGS);
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);

  const selectedOffer = offers.find((o) => o.id === selectedOfferId) || null;

  const addOffer = () => {
    const newOffer: Offer = {
      id: Date.now().toString(),
      name: "Novo Produto",
      price: 0,
      highlight: false,
    };
    setOffers([...offers, newOffer]);
    setSelectedOfferId(newOffer.id);
  };

  const updateOffer = (id: string, updates: Partial<Offer>) => {
    setOffers(offers.map((o) => (o.id === id ? { ...o, ...updates } : o)));
  };

  const deleteOffer = (id: string) => {
    setOffers(offers.filter((o) => o.id !== id));
    if (selectedOfferId === id) setSelectedOfferId(null);
  };

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: "#f5f5f5" }}>
      {/* Sidebar */}
      <aside className="w-80 bg-white border-r border-border flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <Button variant="ghost" size="sm" className="gap-2 mb-4" asChild>
            <a href="/flyers">
              <ChevronLeft className="w-4 h-4" />
              Voltar
            </a>
          </Button>
          <h1 className="text-lg font-semibold text-foreground">Editar Encarte</h1>
          <p className="text-sm text-muted-foreground">ID: {flyerId}</p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="offers" className="flex-1 flex flex-col">
          <TabsList className="w-full justify-start rounded-none border-b px-4">
            <TabsTrigger value="offers" className="gap-2">
              <ShoppingBag className="w-4 h-4" />
              Ofertas
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="w-4 h-4" />
              Config
            </TabsTrigger>
          </TabsList>

          {/* Offers Tab */}
          <TabsContent value="offers" className="flex-1 flex flex-col m-0">
            <div className="p-4 flex-1 overflow-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-medium text-sm text-muted-foreground">
                  {offers.length} produtos
                </h2>
                <Button size="sm" variant="outline" className="gap-1" onClick={addOffer}>
                  <Plus className="w-3 h-3" />
                  Adicionar
                </Button>
              </div>

              <div className="space-y-2">
                {offers.map((offer) => (
                  <div
                    key={offer.id}
                    onClick={() => setSelectedOfferId(offer.id)}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedOfferId === offer.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <GripVertical className="w-4 h-4 text-muted-foreground mt-1 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm truncate">{offer.name}</p>
                          {offer.highlight && (
                            <Star className="w-3 h-3 text-yellow-500 fill-yellow-500 shrink-0" />
                          )}
                        </div>
                        {offer.brand && (
                          <p className="text-xs text-muted-foreground">{offer.brand}</p>
                        )}
                        <p className="text-sm font-semibold text-primary mt-1">
                          {brl(offer.price)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteOffer(offer.id);
                        }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}

                {offers.length === 0 && (
                  <div className="text-center py-8">
                    <ShoppingBag className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
                    <p className="text-sm text-muted-foreground">Nenhuma oferta ainda</p>
                    <Button size="sm" className="mt-3 gap-1" onClick={addOffer}>
                      <Plus className="w-3 h-3" />
                      Adicionar oferta
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Selected Offer Editor */}
            {selectedOffer && (
              <>
                <Separator />
                <div className="p-4 space-y-4">
                  <h3 className="font-medium text-sm">Editar Oferta</h3>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs">Nome do Produto</Label>
                      <Input
                        value={selectedOffer.name}
                        onChange={(e) => updateOffer(selectedOffer.id, { name: e.target.value })}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Marca</Label>
                      <Input
                        value={selectedOffer.brand || ""}
                        onChange={(e) => updateOffer(selectedOffer.id, { brand: e.target.value })}
                        placeholder="Opcional"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Preço</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={selectedOffer.price}
                          onChange={(e) =>
                            updateOffer(selectedOffer.id, { price: parseFloat(e.target.value) || 0 })
                          }
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Preço Anterior</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={selectedOffer.oldPrice || ""}
                          onChange={(e) =>
                            updateOffer(selectedOffer.id, {
                              oldPrice: e.target.value ? parseFloat(e.target.value) : null,
                            })
                          }
                          placeholder="Opcional"
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Destaque</Label>
                      <Switch
                        checked={selectedOffer.highlight || false}
                        onCheckedChange={(checked) =>
                          updateOffer(selectedOffer.id, { highlight: checked })
                        }
                      />
                    </div>
                  </div>
                </div>
              </>
            )}
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="flex-1 m-0 overflow-auto">
            <div className="p-4 space-y-6">
              <div className="space-y-4">
                <h3 className="font-medium text-sm flex items-center gap-2">
                  <Store className="w-4 h-4" />
                  Dados da Loja
                </h3>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Nome da Loja</Label>
                    <Input
                      value={settings.storeName || ""}
                      onChange={(e) => setSettings({ ...settings, storeName: e.target.value })}
                      className="h-9"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Endereço</Label>
                    <Input
                      value={settings.address || ""}
                      onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                      className="h-9"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Telefone</Label>
                      <Input
                        value={settings.phone || ""}
                        onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                        className="h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">WhatsApp</Label>
                      <Input
                        value={settings.whatsapp || ""}
                        onChange={(e) => setSettings({ ...settings, whatsapp: e.target.value })}
                        className="h-9"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Instagram</Label>
                    <Input
                      value={settings.instagram || ""}
                      onChange={(e) => setSettings({ ...settings, instagram: e.target.value })}
                      className="h-9"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="font-medium text-sm flex items-center gap-2">
                  <Type className="w-4 h-4" />
                  Texto do Encarte
                </h3>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Título Principal</Label>
                    <Input
                      value={settings.headline || ""}
                      onChange={(e) => setSettings({ ...settings, headline: e.target.value })}
                      className="h-9"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Subtítulo</Label>
                    <Input
                      value={settings.subheadline || ""}
                      onChange={(e) => setSettings({ ...settings, subheadline: e.target.value })}
                      className="h-9"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Validade</Label>
                    <Input
                      value={settings.validity || ""}
                      onChange={(e) => setSettings({ ...settings, validity: e.target.value })}
                      className="h-9"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="font-medium text-sm flex items-center gap-2">
                  <Image className="w-4 h-4" />
                  Visualização
                </h3>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Escala da Fonte ({settings.fontScale}x)</Label>
                    <Slider
                      value={[settings.fontScale || 1]}
                      min={0.5}
                      max={1.5}
                      step={0.1}
                      onValueChange={([v]) => setSettings({ ...settings, fontScale: v })}
                      className="mt-2"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Mostrar Rodapé</Label>
                    <Switch
                      checked={settings.showFooter ?? true}
                      onCheckedChange={(checked) => setSettings({ ...settings, showFooter: checked })}
                    />
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </aside>

      {/* Main Content - Preview */}
      <main className="flex-1 p-8 overflow-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-medium text-foreground">Preview do Encarte</h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2">
              <Eye className="w-4 h-4" />
              Visualizar
            </Button>
            <Button size="sm" className="gap-2">
              <Download className="w-4 h-4" />
              Exportar
            </Button>
          </div>
        </div>

        {/* Preview Container */}
        <div className="flex justify-center">
          <div
            className="bg-white shadow-xl rounded-xl overflow-hidden"
            style={{
              width: formatById("ig_feed").width * 0.4,
              height: formatById("ig_feed").height * 0.4,
              fontSize: `${14 * (settings.fontScale || 1)}px`,
            }}
          >
            {/* Flyer Preview Content */}
            <div className="h-full flex flex-col">
              {/* Header */}
              <div className="bg-primary p-4 text-primary-foreground text-center">
                <h1 className="text-xl font-bold">{settings.headline || "ENCARTE DE OFERTAS"}</h1>
                <p className="text-sm opacity-90">{settings.subheadline}</p>
              </div>

              {/* Offers Grid */}
              <div className="flex-1 p-4 overflow-auto">
                <div className="grid grid-cols-2 gap-3">
                  {offers.slice(0, 4).map((offer) => (
                    <div
                      key={offer.id}
                      className={`p-2 rounded-lg border ${
                        offer.highlight ? "border-primary bg-primary/5" : "border-border"
                      }`}
                    >
                      <p className="font-medium text-sm truncate">{offer.name}</p>
                      {offer.brand && (
                        <p className="text-xs text-muted-foreground">{offer.brand}</p>
                      )}
                      <div className="mt-1">
                        <span className="text-lg font-bold text-primary">
                          {brl(offer.price)}
                        </span>
                        {offer.oldPrice && (
                          <span className="text-xs text-muted-foreground line-through ml-1">
                            {brl(offer.oldPrice)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer */}
              {settings.showFooter !== false && (
                <div className="bg-muted p-3 text-center text-xs text-muted-foreground">
                  <p>{settings.storeName}</p>
                  <p>{settings.validity}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
