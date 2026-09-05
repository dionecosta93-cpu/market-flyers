import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, Search, Sparkles, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { generateProductImage } from "@/lib/ai.functions";
import { importImage, searchProductImages, type ImageCandidate } from "@/lib/images.functions";
import type { Offer } from "@/lib/flyer-types";

type ProductImageDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offer: Offer | null;
  onGenerated: (image: string | null, source?: string | null) => void;
};

type Message = { type: "ok" | "err"; text: string };

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error ?? new Error("Não foi possível ler a imagem."));
    reader.readAsDataURL(file);
  });
}

export function ProductImageDialog({
  open,
  onOpenChange,
  offer,
  onGenerated,
}: ProductImageDialogProps) {
  const [busy, setBusy] = useState(false);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const [candidates, setCandidates] = useState<ImageCandidate[]>([]);
  const [searched, setSearched] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const offerKey = offer ? `${offer.name}|${offer.brand ?? ""}|${offer.size ?? ""}` : "";

  const runSearch = useCallback(async () => {
    if (!offer) return;
    setSearching(true);
    setMessage(null);
    try {
      const result = await searchProductImages({
        name: offer.name,
        brand: offer.brand || undefined,
        size: offer.size || undefined,
      });
      setCandidates(result.candidates);
      if (result.candidates.length === 0) {
        setMessage({
          type: "err",
          text: "Não encontramos uma imagem adequada. Envie a sua ou gere com a IA.",
        });
      }
    } catch (error) {
      setMessage({
        type: "err",
        text: error instanceof Error ? error.message : "Não foi possível buscar imagens agora.",
      });
    } finally {
      setSearching(false);
      setSearched(true);
    }
  }, [offer]);

  useEffect(() => {
    if (!open) {
      setBusy(false);
      setMessage(null);
      setCandidates([]);
      setSearched(false);
      return;
    }
    if (offerKey) void runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, offerKey]);

  if (!offer) return null;

  const currentImage = offer.imageUrl || null;
  const descriptor = [offer.brand, offer.name, offer.size].filter(Boolean).join(" ") || "Produto";

  async function selectCandidate(candidate: ImageCandidate) {
    setBusy(true);
    setMessage(null);
    try {
      const { dataUrl } = await importImage({ url: candidate.url });
      onGenerated(dataUrl, candidate.sourceUrl || candidate.source);
      setMessage({ type: "ok", text: "Imagem aplicada ao produto." });
    } catch (error) {
      setMessage({
        type: "err",
        text: error instanceof Error ? error.message : "Não foi possível usar essa imagem.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMessage({ type: "err", text: "Escolha um arquivo de imagem (PNG, JPG ou WEBP)." });
      return;
    }
    if (file.size > 6_000_000) {
      setMessage({ type: "err", text: "Imagem muito grande. Use uma menor que 6 MB." });
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      onGenerated(dataUrl, "Imagem enviada pelo usuário");
      setMessage({ type: "ok", text: "Sua imagem foi aplicada." });
    } catch (error) {
      setMessage({
        type: "err",
        text: error instanceof Error ? error.message : "Não foi possível usar essa imagem.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleGenerate() {
    setBusy(true);
    setMessage(null);
    try {
      const result = await generateProductImage({
        name: offer!.name || "Produto",
        brand: offer!.brand || undefined,
        size: offer!.size || undefined,
        category: offer!.category || undefined,
      });
      onGenerated(result.dataUrl, "Imagem gerada por IA");
      setMessage({ type: "ok", text: "Imagem gerada com sucesso." });
    } catch (error) {
      setMessage({
        type: "err",
        text:
          error instanceof Error
            ? error.message
            : "Não foi possível gerar a imagem. Tente novamente.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Imagem do produto</DialogTitle>
          <DialogDescription>{descriptor}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
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

          {currentImage ? (
            <div className="rounded-lg border border-border bg-muted p-3 flex items-center justify-center">
              <img
                src={currentImage}
                alt={offer.name}
                className="max-h-40 max-w-full object-contain"
              />
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-muted/40 px-4 py-6 text-center">
              <ImagePlus className="mx-auto h-7 w-7 text-muted-foreground/60" />
              <p className="mt-2 text-sm text-muted-foreground">
                Nenhuma imagem neste produto ainda.
              </p>
            </div>
          )}

          <Tabs defaultValue="buscar">
            <TabsList className="w-full">
              <TabsTrigger value="buscar" className="flex-1 gap-1.5">
                <Search className="h-3.5 w-3.5" /> Buscar
              </TabsTrigger>
              <TabsTrigger value="enviar" className="flex-1 gap-1.5">
                <Upload className="h-3.5 w-3.5" /> Minha imagem
              </TabsTrigger>
              <TabsTrigger value="gerar" className="flex-1 gap-1.5">
                <Sparkles className="h-3.5 w-3.5" /> Gerar
              </TabsTrigger>
            </TabsList>

            <TabsContent value="buscar" className="mt-3 space-y-3">
              {searching ? (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Procurando imagens do produto...
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    {candidates.map((candidate) => (
                      <button
                        key={candidate.url}
                        type="button"
                        disabled={busy}
                        onClick={() => selectCandidate(candidate)}
                        className="group rounded-lg border border-border bg-white p-2 hover:border-primary transition-colors text-left"
                      >
                        <img
                          src={candidate.url}
                          alt={candidate.title}
                          className="h-20 w-full object-contain"
                          loading="lazy"
                        />
                        <p className="mt-1 line-clamp-2 text-[10px] leading-tight text-muted-foreground">
                          {candidate.title}
                        </p>
                        <p className="text-[9px] text-muted-foreground/70">{candidate.source}</p>
                      </button>
                    ))}
                  </div>
                  {searched && candidates.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Não encontramos uma imagem adequada para este produto.
                    </p>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={runSearch}
                    disabled={busy}
                  >
                    <Search className="h-3.5 w-3.5" /> Pesquisar novamente
                  </Button>
                </>
              )}
            </TabsContent>

            <TabsContent value="enviar" className="mt-3 space-y-3">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  void handleFiles(e.dataTransfer.files);
                }}
                className="rounded-xl border-2 border-dashed border-border px-4 py-8 text-center"
              >
                <Upload className="mx-auto h-7 w-7 text-muted-foreground/60" />
                <p className="mt-2 text-sm text-muted-foreground">
                  Arraste a imagem aqui, tire uma foto ou escolha da galeria.
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => void handleFiles(e.target.files)}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 gap-1.5"
                  onClick={() => fileRef.current?.click()}
                  disabled={busy}
                >
                  <Upload className="h-3.5 w-3.5" /> Escolher imagem
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="gerar" className="mt-3 space-y-3">
              <p className="text-sm text-muted-foreground">
                Use só quando não existir uma foto real adequada do produto.
              </p>
              <Button onClick={handleGenerate} disabled={busy} className="w-full gap-2">
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {busy ? "Gerando imagem..." : "Gerar imagem com IA"}
              </Button>
            </TabsContent>
          </Tabs>

          {currentImage && (
            <Button
              variant="outline"
              onClick={() => {
                onGenerated(null, null);
                setMessage(null);
              }}
              className="w-full gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Remover imagem
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
