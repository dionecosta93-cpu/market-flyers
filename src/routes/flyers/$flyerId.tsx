import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ShoppingBag,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Save,
  Sparkles,
  Star,
  GripVertical,
  Settings,
  Type,
  Store,
  Pencil,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AuthView, useAuthSession } from "@/components/auth-view";
import { organizeFlyer, verifyFlyer } from "@/lib/ai.functions";
import { OfferImportDialog } from "@/components/offer-import-dialog";
import { ProductImageDialog } from "@/components/product-image-dialog";
import {
  brl,
  formatById,
  newId,
  PER_PAGE_OPTIONS,
  FORMATS,
  type FlyerPage,
  type FlyerRow,
  type FlyerSettings,
  type Offer,
} from "@/lib/flyer-types";
import { TEMPLATES, templateById } from "@/lib/templates";

export const Route = createFileRoute("/flyers/$flyerId")({
  component: FlyerEditorPage,
});

const DEFAULT_SETTINGS: FlyerSettings = {
  storeName: "",
  headline: "OFERTAS DA SEMANA",
  subheadline: "Aproveite os melhores preços",
  validity: "",
  phone: "",
  whatsapp: "",
  address: "",
  instagram: "",
  fontScale: 1,
  showFooter: true,
};

function PageCanvas({
  page,
  settings,
  templateId,
  layoutMode = "grade",
  onReorder,
}: {
  page: FlyerPage;
  settings: FlyerSettings;
  templateId: string;
  layoutMode?: "grade" | "destaque" | "misto";
  onReorder?: (fromIndex: number, toIndex: number) => void;
}) {
  const tpl = templateById(templateId || "tradicional");
  const scale = settings.fontScale || 1;
  const items = page?.items || [];
  const highlighted = items.filter((i) => i.highlight);
  const normal = items.filter((i) => !i.highlight);
  const [dragId, setDragId] = useState<string | null>(null);

  return (
    <div
      className="w-full h-full flex flex-col"
      style={{ backgroundColor: tpl.bg, fontSize: `${12 * scale}px` }}
    >
      <div
        className="px-5 py-4 text-center shrink-0"
        style={{ backgroundColor: tpl.header, color: tpl.headerText }}
      >
        <h1
          className="text-[26px] leading-tight font-black tracking-tight"
          style={{
            fontFamily: tpl.headingFont,
            fontSize: `${Math.round(26 * scale)}px`,
          }}
        >
          {settings.headline || "ENCARTE DE OFERTAS"}
        </h1>
        {settings.subheadline && (
          <p className="text-[13px] opacity-90 mt-1" style={{ fontSize: `${Math.round(13 * scale)}px` }}>
            {settings.subheadline}
          </p>
        )}
      </div>

      <div className="flex-1 p-4 overflow-hidden">
        {items.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-sm" style={{ color: tpl.headerText }}>
              Adicione ofertas para começar
            </p>
          </div>
        ) : layoutMode === "destaque" && highlighted.length > 0 && normal.length > 0 ? (
          <div className="h-full flex flex-col gap-3 content-start overflow-y-auto">
            <div
              className="rounded-2xl p-4 flex flex-col"
              style={{
                backgroundColor: tpl.card,
                borderColor: tpl.cardBorder,
                color: tpl.cardText,
                borderRadius: tpl.radius,
                boxShadow: "0 4px 6px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.06)",
                borderWidth: "1px",
                borderStyle: "solid",
              }}
            >
              {highlighted.map((offer) => (
                <ProductCard
                  key={offer.id}
                  offer={offer}
                  template={tpl}
                  scale={scale}
                  prominent
                  draggable
                  onDragStart={setDragId}
                  onDragEnd={() => setDragId(null)}
                  onDrop={(id) => {
                    const fromIdx = items.findIndex((i) => i.id === dragId);
                    const toIdx = items.findIndex((i) => i.id === id);
                    if (fromIdx >= 0 && toIdx >= 0 && fromIdx !== toIdx) {
                      onReorder?.(fromIdx, toIdx);
                    }
                    setDragId(null);
                  }}
                />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 content-start">
              {normal.map((offer) => (
                <ProductCard
                  key={offer.id}
                  offer={offer}
                  template={tpl}
                  scale={scale}
                  draggable
                  onDragStart={setDragId}
                  onDragEnd={() => setDragId(null)}
                  onDrop={(id) => {
                    const fromIdx = items.findIndex((i) => i.id === dragId);
                    const toIdx = items.findIndex((i) => i.id === id);
                    if (fromIdx >= 0 && toIdx >= 0 && fromIdx !== toIdx) {
                      onReorder?.(fromIdx, toIdx);
                    }
                    setDragId(null);
                  }}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="h-full grid grid-cols-2 gap-3 content-start">
            {items.map((offer) => (
              <ProductCard
                key={offer.id}
                offer={offer}
                template={tpl}
                scale={scale}
                prominent={!!offer.highlight}
                draggable
                onDragStart={setDragId}
                onDragEnd={() => setDragId(null)}
                onDrop={(id) => {
                  const fromIdx = items.findIndex((i) => i.id === dragId);
                  const toIdx = items.findIndex((i) => i.id === id);
                  if (fromIdx >= 0 && toIdx >= 0 && fromIdx !== toIdx) {
                    onReorder?.(fromIdx, toIdx);
                  }
                  setDragId(null);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {settings.showFooter !== false && (
        <div
          className="px-4 py-3 text-center shrink-0"
          style={{ backgroundColor: tpl.accent, color: tpl.accentText }}
        >
          <p className="font-bold" style={{ fontSize: `${Math.round(11 * scale)}px` }}>
            {settings.storeName || "Sua loja aqui"}
          </p>
          {settings.validity && (
            <p className="opacity-90" style={{ fontSize: `${Math.round(10 * scale)}px` }}>
              {settings.validity}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ProductCard({
  offer,
  template,
  scale,
  prominent = false,
  draggable = false,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  offer: Offer;
  template: FlyerTemplate;
  scale: number;
  prominent?: boolean;
  draggable?: boolean;
  onDragStart?: (id: string) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (id: string) => void;
  onDragEnd?: () => void;
}) {
  return (
    <div
      draggable={draggable}
      onDragStart={() => onDragStart?.(offer.id)}
      onDragOver={(e) => { e.preventDefault(); onDragOver?.(e); }}
      onDrop={() => onDrop?.(offer.id)}
      onDragEnd={onDragEnd}
      className={`flex flex-col min-h-0 ${prominent ? "md:col-span-2" : ""}`}
      style={{
        backgroundColor: template.card,
        borderColor: template.cardBorder,
        color: template.cardText,
        borderRadius: template.radius,
        boxShadow: prominent
          ? "0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.08)"
          : "0 1px 3px rgba(0,0,0,0.08)",
        borderWidth: "1px",
        borderStyle: "solid",
        padding: prominent ? "16px" : "12px",
        cursor: draggable ? "grab" : "default",
        opacity: draggable ? undefined : 1,
      }}
    >
      <div className="min-w-0 flex-1">
        <p
          className="font-bold leading-tight line-clamp-2"
          style={{
            fontFamily: template.headingFont,
            textTransform: template.uppercaseNames ? "uppercase" : "none",
            fontSize: `${Math.round((prominent ? 16 : 12) * scale)}px`,
          }}
        >
          {offer.name}
        </p>
        {offer.brand && (
          <p className="text-[10px] leading-tight opacity-70 truncate mt-0.5">{offer.brand}</p>
        )}
        {offer.size && (
          <p className="text-[10px] leading-tight opacity-60 truncate">{offer.size}</p>
        )}
      </div>

      {template.showImage && offer.imageUrl && (
        <div
          className="mt-2 flex items-center justify-center bg-white/60 rounded-lg overflow-hidden"
          style={{ height: prominent ? "120px" : "80px" }}
        >
          <img
            src={offer.imageUrl}
            alt={offer.name}
            className="max-h-full max-w-full object-contain p-1"
            style={{ imageRendering: "auto" }}
          />
        </div>
      )}

      <div className="mt-auto pt-2">
        {offer.oldPrice ? (
          <p
            className="text-[10px] opacity-60 line-through"
            style={{ fontSize: `${Math.round(10 * scale)}px` }}
          >
            {brl(offer.oldPrice)}
          </p>
        ) : null}
        <span
          className="inline-block rounded-lg px-3 py-1.5 font-black"
          style={{
            backgroundColor: template.price,
            color: template.priceText,
            fontSize: `${Math.round((prominent ? 20 : 15) * scale)}px`,
            boxShadow: "0 2px 4px rgba(0,0,0,0.15)",
          }}
        >
          {brl(offer.price || 0)}
        </span>
      </div>
    </div>
  );
}

function FlyerEditorPage() {
  const navigate = useNavigate();
  const { flyerId } = Route.useParams();
  const { session, authLoading } = useAuthSession();

  const [loaded, setLoaded] = useState(false);
  const [rowLoading, setRowLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [title, setTitle] = useState("Novo encarte");
  const [template, setTemplate] = useState("tradicional");
  const [format, setFormat] = useState("ig_feed");
  const [perPage, setPerPage] = useState(8);
  const [status, setStatus] = useState("rascunho");
  const [pages, setPages] = useState<FlyerPage[]>([]);
  const [settings, setSettings] = useState<FlyerSettings>(DEFAULT_SETTINGS);
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [downloadCount, setDownloadCount] = useState(0);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [aiBusy, setAiBusy] = useState(false);
  const previewRef = useRef<HTMLDivElement | null>(null);

  const [importOpen, setImportOpen] = useState(false);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ approved: boolean; issues: Array<{ severity: string; message: string; productId?: string }> } | null>(null);

  async function handleVerify() {
    const flat = pages.flatMap((p) => p.items || []);
    if (flat.length === 0) return;
    setVerifying(true);
    setVerifyOpen(true);
    setVerifyResult(null);
    try {
      const result = await verifyFlyer({
        data: {
          products: flat.map((o) => ({
            id: o.id,
            name: o.name,
            brand: o.brand || "",
            size: o.size || "",
            price: Number(o.price) || 0,
            oldPrice: o.oldPrice ?? null,
            category: o.category || "",
          })),
          headline: title,
          subheadline: settings.subheadline || "",
        },
      });
      setVerifyResult(result);
    } catch (error) {
      console.error(error);
      setVerifyResult({
        approved: false,
        issues: [{ severity: "error", message: "Não foi possível realizar a verificação. Tente novamente." }],
      });
    } finally {
      setVerifying(false);
    }
  }

  useEffect(() => {
    if (!session) {
      setLoaded(false);
      setRowLoading(false);
      setLoadError(null);
      return;
    }

    let cancelled = false;
    setRowLoading(true);
    setLoadError(null);

    supabase
      .from("flyers")
      .select("*")
      .eq("id", flyerId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setLoadError("Encarte não encontrado ou você não tem permissão para abri-lo.");
          setRowLoading(false);
          return;
        }

        const row = data as unknown as FlyerRow;
        const validPages =
          Array.isArray(row.pages) && row.pages.length > 0
            ? (row.pages as FlyerPage[])
            : [{ id: newId(), items: [] as Offer[] }];

        setTitle(row.title || "Novo encarte");
        setTemplate(row.template || "tradicional");
        setFormat(row.format || "ig_feed");
        setPerPage(row.per_page || 8);
        setStatus(row.status || "rascunho");
        setPages(validPages);
        setSettings({ ...DEFAULT_SETTINGS, ...((row.settings as FlyerSettings) || {}) });
        setActiveIndex(0);
        setSelectedOfferId(null);
        setDownloadCount(typeof row.download_count === "number" ? row.download_count : 0);
        setLoaded(true);
        setRowLoading(false);
      })
      .then(undefined, (err: unknown) => {
        if (cancelled) return;
        console.error(err);
        setLoadError("Erro ao carregar o encarte.");
        setRowLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [flyerId, session?.user.id]);

  async function persistNow(extraFields: Record<string, unknown> = {}) {
    const { error } = await supabase
      .from("flyers")
      .update({
        title,
        template,
        format,
        per_page: perPage,
        pages: pages as any,
        settings: settings as any,
        status,
        ...extraFields,
      })
      .eq("id", flyerId);
    return error;
  }

  useEffect(() => {
    if (!session || !loaded) return;
    setSaveState("saving");
    const timeout = setTimeout(async () => {
      const error = await persistNow();
      setSaveState(error ? "error" : "saved");
      if (error) console.error(error);
    }, 900);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id, loaded, title, template, format, perPage, status, pages, settings]);

  const tpl = templateById(template || "tradicional");
  const fmt = formatById(format || "ig_feed");
  const safeIndex = Math.min(Math.max(activeIndex, 0), Math.max(pages.length - 1, 0));
  const activePage = pages[safeIndex] || { id: "vazio", items: [] as Offer[] };
  const offers = activePage.items || [];
  const selectedOffer = offers.find((o) => o.id === selectedOfferId) || null;

  function setActivePageItems(updater: (items: Offer[]) => Offer[]) {
    setPages((prev) =>
      prev.map((page, i) =>
        i === safeIndex ? { ...page, items: updater(page.items || []) } : page,
      ),
    );
  }

  function addOffer() {
    const offer: Offer = {
      id: newId(),
      name: "Novo Produto",
      price: 0,
      highlight: false,
    };
    setActivePageItems((items) => [...items, offer]);
    setSelectedOfferId(offer.id);
  }

  function updateOffer(offerId: string, updates: Partial<Offer>) {
    setActivePageItems((items) => items.map((o) => (o.id === offerId ? { ...o, ...updates } : o)));
  }

  function deleteOffer(offerId: string) {
    const nextItems = offers.filter((o) => o.id !== offerId);
    if (nextItems.length === 0 && pages.length > 1) {
      const nextPages = pages.filter((_, i) => i !== safeIndex);
      setPages(nextPages);
      setActiveIndex(Math.max(0, safeIndex - 1));
    } else {
      setActivePageItems((items) => items.filter((o) => o.id !== offerId));
    }
    if (selectedOfferId === offerId) setSelectedOfferId(null);
  }

  function nextPage() {
    setActiveIndex((i) => Math.min(i + 1, pages.length - 1));
    setSelectedOfferId(null);
  }

  function prevPage() {
    setActiveIndex((i) => Math.max(i - 1, 0));
    setSelectedOfferId(null);
  }

  function handleAddImported(items: Offer[]) {
    setActivePageItems((prev) => [...prev, ...items]);
  }

  function handleReplacePage(items: Offer[]) {
    setPages((prev) => prev.map((page, i) => (i === safeIndex ? { ...page, items } : page)));
  }

  function handleImageGenerated(image: string | null) {
    if (!selectedOfferId) return;
    updateOffer(selectedOfferId, {
      imagePath: null,
      imageUrl: image,
    });
  }

  async function handleOrganize() {
    const flat = pages.flatMap((p) => p.items || []);
    if (flat.length === 0) return;
    setAiBusy(true);
    setSaveState("saving");
    try {
      const result = await organizeFlyer({
        data: {
          products: flat.map((o) => ({
            id: o.id,
            name: o.name,
            brand: o.brand || "",
            size: o.size || "",
            price: Number(o.price) || 0,
            oldPrice: o.oldPrice ?? null,
          })),
          perPage,
        },
      });

      const byId = new Map(flat.map((o) => [o.id, o]));
      const ordered: Offer[] = [];
      result.order.forEach((id: string) => {
        const item = byId.get(String(id));
        if (item) {
          ordered.push({ ...item, highlight: result.highlight.includes(String(id)) });
          byId.delete(String(id));
        }
      });
      byId.forEach((item) => ordered.push({ ...item, highlight: false }));

      const chunks: FlyerPage[] = [];
      for (let i = 0; i < ordered.length; i += perPage) {
        chunks.push({ id: newId(), items: ordered.slice(i, i + perPage) });
      }

      setPages(chunks.length ? chunks : [{ id: newId(), items: [] }]);
      setActiveIndex(0);
      setSelectedOfferId(null);
      setSettings((prev) => ({
        ...prev,
        headline: result.headline || prev.headline,
        subheadline: result.subheadline || prev.subheadline,
      }));
    } catch (error) {
      console.error(error);
      setSaveState("error");
    } finally {
      setAiBusy(false);
    }
  }

  async function handleFixWithAI() {
    const flat = pages.flatMap((p) => p.items || []);
    if (flat.length === 0) return;
    setAiBusy(true);
    setSaveState("saving");
    try {
      const result = await organizeFlyer({
        data: {
          products: flat.map((o) => ({
            id: o.id,
            name: o.name,
            brand: o.brand || "",
            size: o.size || "",
            price: Number(o.price) || 0,
            oldPrice: o.oldPrice ?? null,
          })),
          perPage,
        },
      });

      const byId = new Map(flat.map((o) => [o.id, o]));
      const ordered: Offer[] = [];
      result.order.forEach((id: string) => {
        const item = byId.get(String(id));
        if (item) {
          ordered.push({ ...item, highlight: result.highlight.includes(String(id)) });
          byId.delete(String(id));
        }
      });
      byId.forEach((item) => ordered.push({ ...item, highlight: false }));

      const chunks: FlyerPage[] = [];
      for (let i = 0; i < ordered.length; i += perPage) {
        chunks.push({ id: newId(), items: ordered.slice(i, i + perPage) });
      }

      setPages(chunks.length ? chunks : [{ id: newId(), items: [] }]);
      setActiveIndex(0);
      setSelectedOfferId(null);
      setSettings((prev) => ({
        ...prev,
        headline: result.headline || prev.headline,
        subheadline: result.subheadline || prev.subheadline,
      }));
    } catch (error) {
      console.error(error);
      setSaveState("error");
    } finally {
      setAiBusy(false);
    }
  }

  async function exportPng() {
    const node = previewRef.current;
    if (!node) return;
    setSaveState("saving");
    try {
      const dataUrl = await toPng(node, {
        pixelRatio: 2,
        backgroundColor: "#ffffff",
      });
      const link = document.createElement("a");
      link.download = `${(title || "encarte").replace(/[^a-zA-Z0-9-]/g, "-").toLowerCase() || "encarte"}.png`;
      link.href = dataUrl;
      link.click();
      const error = await persistNow({ download_count: downloadCount + 1 });
      if (!error) setDownloadCount((c) => c + 1);
      setSaveState(error ? "error" : "saved");
      if (error) console.error(error);
    } catch (error) {
      console.error(error);
      setSaveState("error");
    }
  }

  async function exportJpg() {
    const node = previewRef.current;
    if (!node) return;
    setSaveState("saving");
    try {
      const dataUrl = await toPng(node, {
        pixelRatio: 2,
        backgroundColor: "#ffffff",
      });
      const img = new Image();
      img.src = dataUrl;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas indisponível");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      const jpgUrl = canvas.toDataURL("image/jpeg", 0.92);
      const link = document.createElement("a");
      link.download = `${(title || "encarte").replace(/[^a-zA-Z0-9-]/g, "-").toLowerCase() || "encarte"}.jpg`;
      link.href = jpgUrl;
      link.click();
      setSaveState("saved");
    } catch (error) {
      console.error(error);
      setSaveState("error");
    }
  }

  async function exportPdf() {
    const node = previewRef.current;
    if (!node) return;
    setSaveState("saving");
    try {
      const { jsPDF } = await import("jspdf");
      const dataUrl = await toPng(node, {
        pixelRatio: 2,
        backgroundColor: "#ffffff",
      });
      const img = new Image();
      img.src = dataUrl;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });
      const orientation = img.naturalWidth > img.naturalHeight ? "landscape" : "portrait";
      const pdf = new jsPDF({
        orientation,
        unit: "px",
        format: [img.naturalWidth, img.naturalHeight],
      });
      pdf.addImage(dataUrl, "PNG", 0, 0, img.naturalWidth, img.naturalHeight);
      pdf.save(`${(title || "encarte").replace(/[^a-zA-Z0-9-]/g, "-").toLowerCase() || "encarte"}.pdf`);
      setSaveState("saved");
    } catch (error) {
      console.error(error);
      setSaveState("error");
    }
  }

  const [autoOrganizing, setAutoOrganizing] = useState(false);

  const saveLabel =
    saveState === "saving"
      ? "Salvando..."
      : saveState === "saved"
        ? "Salvo"
        : saveState === "error"
          ? "Erro ao salvar"
          : "Alterações salvas automaticamente";

  useEffect(() => {
    if (!session || !loaded) return;
    let cancelled = false;
    setAutoOrganizing(true);
    const timeout = setTimeout(async () => {
      const flat = pages.flatMap((p) => p.items || []);
      if (flat.length === 0 || !cancelled) {
        setAutoOrganizing(false);
        return;
      }
      try {
        const result = await organizeFlyer({
          data: {
            products: flat.map((o) => ({
              id: o.id,
              name: o.name,
              brand: o.brand || "",
              size: o.size || "",
              price: Number(o.price) || 0,
              oldPrice: o.oldPrice ?? null,
            })),
            perPage,
          },
        });
        if (cancelled) return;
        const byId = new Map(flat.map((o) => [o.id, o]));
        const ordered: Offer[] = [];
        result.order.forEach((id: string) => {
          const item = byId.get(String(id));
          if (item) {
            ordered.push({ ...item, highlight: result.highlight.includes(String(id)) });
            byId.delete(String(id));
          }
        });
        byId.forEach((item) => ordered.push({ ...item, highlight: false }));
        const chunks: FlyerPage[] = [];
        for (let i = 0; i < ordered.length; i += perPage) {
          chunks.push({ id: newId(), items: ordered.slice(i, i + perPage) });
        }
        setPages(chunks.length ? chunks : [{ id: newId(), items: [] }]);
        setActiveIndex(0);
        setSelectedOfferId(null);
        setSettings((prev) => ({
          ...prev,
          headline: result.headline || prev.headline,
          subheadline: result.subheadline || prev.subheadline,
        }));
      } catch (error) {
        console.error(error);
      } finally {
        if (!cancelled) setAutoOrganizing(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [format]);

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

  if (!rowLoading && loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-sm w-full text-center">
          <ShoppingBag className="w-10 h-10 mx-auto text-muted-foreground/50 mb-4" />
          <h1 className="text-lg font-semibold text-foreground mb-2">{loadError}</h1>
          <Button variant="outline" onClick={() => navigate({ to: "/flyers" })}>
            Voltar para meus encartes
          </Button>
        </div>
      </div>
    );
  }

  if (rowLoading || !loaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/40 flex">
      <aside className="w-[340px] shrink-0 bg-background border-r border-border flex flex-col max-h-screen">
        <div className="p-4 border-b border-border space-y-3">
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="gap-2"
              onClick={() => navigate({ to: "/flyers" })}
            >
              <ChevronLeft className="w-4 h-4" />
              Voltar
            </Button>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                className={`inline-block w-2 h-2 rounded-full ${
                  saveState === "error" ? "bg-destructive" : "bg-emerald-500"
                }`}
              />
              {saveLabel}
            </span>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-9 mt-1" />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="flex h-9 items-center rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="rascunho">Rascunho</option>
              <option value="published">Publicado</option>
            </select>
            <Button size="sm" className="gap-2 flex-1" onClick={() => persistNow()}>
              <Save className="w-4 h-4" />
              Salvar
            </Button>
          </div>
        </div>

        <Tabs defaultValue="offers" className="flex-1 flex flex-col min-h-0">
          <TabsList className="w-full justify-start rounded-none border-b border-border px-4 bg-transparent">
            <TabsTrigger value="offers" className="gap-2">
              <ShoppingBag className="w-4 h-4" />
              Ofertas
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="w-4 h-4" />
              Config
            </TabsTrigger>
          </TabsList>

          <TabsContent value="offers" className="flex-1 m-0 flex flex-col min-h-0">
            <div className="p-4 flex-1 overflow-y-auto">
              <div className="flex items-center justify-between gap-2 mb-4">
                <span className="text-sm font-medium text-muted-foreground">
                  {offers.length} {offers.length === 1 ? "produto" : "produtos"} nesta página
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 text-xs"
                    onClick={handleOrganize}
                    disabled={aiBusy || offers.length === 0}
                    title="Organizar produtos, categorias e destaques com OpenAI"
                  >
                    {aiBusy ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Sparkles className="w-3 h-3 text-emerald-600" />
                    )}
                    Organizar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 text-xs"
                    onClick={() => setImportOpen(true)}
                    disabled={aiBusy}
                  >
                    {aiBusy ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Sparkles className="w-3 h-3" />
                    )}
                    Importar IA
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={addOffer}>
                    <Plus className="w-3 h-3" />
                    Adicionar
                  </Button>
                </div>
              </div>

              {pages.length > 1 && (
                <div className="flex items-center justify-center gap-2 mb-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={prevPage}
                    disabled={safeIndex === 0}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground px-2">
                    Página {safeIndex + 1} de {pages.length}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={nextPage}
                    disabled={safeIndex === pages.length - 1}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}

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
                          <p className="text-xs text-muted-foreground truncate">{offer.brand}</p>
                        )}
                        <p className="text-sm font-semibold text-primary mt-0.5">
                          {brl(offer.price || 0)}
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
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          const copy = { ...offer, id: newId() };
                          setActivePageItems((items) => {
                            const idx = items.findIndex((x) => x.id === offer.id);
                            const next = [...items];
                            next.splice(idx + 1, 0, copy as Offer);
                            return next;
                          });
                          setSelectedOfferId(copy.id);
                        }}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {offers.length === 0 && (
                <div className="text-center py-10 rounded-xl border border-dashed">
                  <ShoppingBag className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground mb-4">Esta página está vazia</p>
                  <div className="flex flex-col items-center gap-2">
                    <Button size="sm" className="gap-1" onClick={() => setImportOpen(true)}>
                      <Sparkles className="w-3 h-3" />
                      Importar com IA
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1" onClick={addOffer}>
                      <Plus className="w-3 h-3" />
                      Adicionar manualmente
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {selectedOffer && (
              <>
                <Separator />
                <div className="p-4 space-y-4 border-t border-border overflow-y-auto max-h-[45vh]">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-sm flex items-center gap-2">
                      <Pencil className="w-4 h-4" />
                      Editar Oferta
                    </h3>
                    <div className="flex items-center gap-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1 py-0"
                        onClick={() => setImageDialogOpen(true)}
                      >
                        <Sparkles className="w-3 h-3" /> Imagem IA
                      </Button>
                      <span className="text-[11px] text-muted-foreground">
                        {selectedOffer.highlight ? "Em destaque" : "Normal"}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs">Nome do Produto</Label>
                      <Input
                        value={selectedOffer.name}
                        onChange={(e) => updateOffer(selectedOffer.id, { name: e.target.value })}
                        className="h-8 text-sm mt-1"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Marca</Label>
                        <Input
                          value={selectedOffer.brand || ""}
                          onChange={(e) => updateOffer(selectedOffer.id, { brand: e.target.value })}
                          placeholder="Opcional"
                          className="h-8 text-sm mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Peso / Volume</Label>
                        <Input
                          value={selectedOffer.size || ""}
                          onChange={(e) => updateOffer(selectedOffer.id, { size: e.target.value })}
                          placeholder="Ex: 5 kg"
                          className="h-8 text-sm mt-1"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Preço</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={selectedOffer.price}
                          onChange={(e) =>
                            updateOffer(selectedOffer.id, {
                              price: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="h-8 text-sm mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Preço Anterior</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={selectedOffer.oldPrice ?? ""}
                          onChange={(e) =>
                            updateOffer(selectedOffer.id, {
                              oldPrice: e.target.value.trim() ? parseFloat(e.target.value) : null,
                            })
                          }
                          placeholder="Opcional"
                          className="h-8 text-sm mt-1"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-xs">Destacar no encarte</Label>
                      <Switch
                        checked={!!selectedOffer.highlight}
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

          <TabsContent value="settings" className="flex-1 m-0 overflow-y-auto">
            <div className="p-4 space-y-6">
              <div className="space-y-4">
                <h3 className="font-medium text-sm flex items-center gap-2">
                  <Store className="w-4 h-4" />
                  Apresentação
                </h3>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Modelo de encarte</Label>
                    <select
                      value={template}
                      onChange={(e) => setTemplate(e.target.value)}
                      className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      {TEMPLATES.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} — {t.description}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs">Dimensão / rede social</Label>
                    <select
                      value={format}
                      onChange={(e) => setFormat(e.target.value)}
                      className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      {FORMATS.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.label} ({f.width}×{f.height})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs">Produtos por página</Label>
                    <select
                      value={perPage}
                      onChange={(e) => setPerPage(parseInt(e.target.value) || 8)}
                      className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      {PER_PAGE_OPTIONS.map((n) => (
                        <option key={n} value={n}>
                          {n} produtos
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      O botão de IA usa este valor para distribuir as páginas.
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

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
                      className="h-9 mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Endereço</Label>
                    <Input
                      value={settings.address || ""}
                      onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                      className="h-9 mt-1"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Telefone</Label>
                      <Input
                        value={settings.phone || ""}
                        onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                        className="h-9 mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">WhatsApp</Label>
                      <Input
                        value={settings.whatsapp || ""}
                        onChange={(e) => setSettings({ ...settings, whatsapp: e.target.value })}
                        className="h-9 mt-1"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Instagram</Label>
                    <Input
                      value={settings.instagram || ""}
                      onChange={(e) => setSettings({ ...settings, instagram: e.target.value })}
                      className="h-9 mt-1"
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
                      className="h-9 mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Subtítulo</Label>
                    <Input
                      value={settings.subheadline || ""}
                      onChange={(e) => setSettings({ ...settings, subheadline: e.target.value })}
                      className="h-9 mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Validade</Label>
                    <Input
                      value={settings.validity || ""}
                      onChange={(e) => setSettings({ ...settings, validity: e.target.value })}
                      className="h-9 mt-1"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="font-medium text-sm">Visualização</h3>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Escala da Fonte ({settings.fontScale || 1}x)</Label>
                    <Slider
                      value={[settings.fontScale || 1]}
                      min={0.5}
                      max={1.5}
                      step={0.1}
                      onValueChange={([v]) => setSettings({ ...settings, fontScale: v || 1 })}
                      className="mt-2"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Mostrar Rodapé</Label>
                    <Switch
                      checked={settings.showFooter ?? true}
                      onCheckedChange={(checked) =>
                        setSettings({ ...settings, showFooter: checked })
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <OfferImportDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          offers={offers}
          onAddMany={handleAddImported}
          onReplaceAll={handleReplacePage}
        />

        <ProductImageDialog
          open={imageDialogOpen}
          onOpenChange={setImageDialogOpen}
          offer={selectedOffer}
          onGenerated={handleImageGenerated}
        />
      </aside>

      <main className="flex-1 p-6 lg:p-10 overflow-y-auto max-h-screen">
        <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
          <div>
            <h2 className="text-lg font-medium text-foreground">Prévia do Encarte</h2>
            <p className="text-xs text-muted-foreground">
              {fmt.label} · página {safeIndex + 1} de {Math.max(pages.length, 1)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => {
                prevPage();
              }}
              disabled={safeIndex === 0}
            >
              <ChevronLeft className="w-4 h-4" />
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => {
                nextPage();
              }}
              disabled={safeIndex === pages.length - 1}
            >
              Próxima
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleFixWithAI}
              disabled={aiBusy || offers.length === 0}
              title="Corrigir layout, alinhamento e hierarquia com IA"
            >
              {aiBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Corrigir com IA
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleVerify}
              disabled={verifying || offers.length === 0}
              title="Verificar encarte com IA"
            >
              {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Verificar com IA
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Download className="w-4 h-4" />
                  Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportPng}>Baixar PNG</DropdownMenuItem>
                <DropdownMenuItem onClick={exportJpg}>Baixar JPG</DropdownMenuItem>
                <DropdownMenuItem onClick={exportPdf}>Baixar PDF</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex justify-center">
          <div
            ref={previewRef}
            className="bg-white shadow-xl rounded-xl overflow-hidden"
            style={{
              width: Math.round(fmt.width * 0.4),
              height: Math.round(fmt.height * 0.4),
            }}
          >
            <PageCanvas
              page={activePage}
              settings={settings}
              templateId={template}
              layoutMode="grade"
              onReorder={(fromIndex, toIndex) => {
                setActivePageItems((items) => {
                  const next = [...items];
                  const [moved] = next.splice(fromIndex, 1);
                  next.splice(toIndex, 0, moved);
                  return next;
                });
              }}
            />
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          {downloadCount > 0
            ? `${downloadCount} ${downloadCount === 1 ? "download realizado" : "downloads realizados"}`
            : "Nenhum download até agora"}
        </p>
      </main>
    </div>
  );
}

<AlertDialog open={verifyOpen} onOpenChange={setVerifyOpen}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>
        {verifying ? "Verificando encarte..." : verifyResult?.approved ? "Encarte aprovado" : "Problemas encontrados"}
      </AlertDialogTitle>
      <AlertDialogDescription>
        {verifying
          ? "A IA está analisando seu encarte. Aguarde..."
          : verifyResult?.approved
            ? "Seu encarte passou em todas as verificações de qualidade."
            : "Encontramos alguns pontos que podem ser melhorados:"}
      </AlertDialogDescription>
    </AlertDialogHeader>
    <div className="max-h-[60vh] overflow-y-auto space-y-2">
      {verifying && (
        <div className="flex items-center justify-center gap-2 py-8">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm text-muted-foreground">Verificando...</span>
        </div>
      )}
      {!verifying && verifyResult?.issues && verifyResult.issues.length > 0 && (
        <div className="space-y-2">
          {verifyResult.issues.map((issue, idx) => (
            <div
              key={idx}
              className={`rounded-lg border p-3 text-sm ${
                issue.severity === "error"
                  ? "border-destructive/40 bg-destructive/10 text-destructive"
                  : "border-yellow-500/40 bg-yellow-500/10 text-yellow-700"
              }`}
            >
              <p className="font-medium">{issue.severity === "error" ? "Erro" : "Aviso"}</p>
              <p>{issue.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
    <AlertDialogFooter>
      <Button onClick={() => setVerifyOpen(false)}>Fechar</Button>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
