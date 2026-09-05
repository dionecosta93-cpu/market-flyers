import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, Send, Square, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { parseOffers } from "@/lib/ai.functions";
import { newId, type FlyerPage, type Offer } from "@/lib/flyer-types";
import { supabase } from "@/integrations/supabase/client";

type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

type FlyerCreateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onCreated: (flyerId: string) => void;
};

function toNewOffers(items: unknown[]): Offer[] {
  return items.map((item: unknown) => {
    const i = item as Record<string, unknown>;
    return {
      id: newId(),
      name: String(i?.name ?? "Produto").trim() || "Produto",
      brand: typeof i?.brand === "string" ? i.brand.trim() : "",
      size: typeof i?.size === "string" ? i.size.trim() : "",
      price: Number(i?.price) || 0,
      oldPrice: i?.oldPrice == null ? null : Number(i.oldPrice),
      category: typeof i?.category === "string" ? i.category : "Outros",
      qty: typeof i?.qty === "string" ? i.qty : "",
    };
  });
}

function messageFor(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Não foi possível criar o encarte. Tente novamente.";
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64 || "");
    };
    reader.onerror = () => reject(reader.error ?? new Error("Não foi possível ler o áudio."));
    reader.readAsDataURL(blob);
  });
}

export function FlyerCreateDialog({
  open,
  onOpenChange,
  userId,
  onCreated,
}: FlyerCreateDialogProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "0",
      role: "assistant",
      text: 'Olá! Descreva as ofertas do seu encarte. Você pode digitar, colar uma lista ou falar no microfone. Exemplo: "Arroz 5kg 29,90, Feijão 1kg 7,49, Leite Integral 1L 4,99"',
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);

  useEffect(() => {
    if (!open) {
      setMessages([
        {
          id: "0",
          role: "assistant",
          text: 'Olá! Descreva as ofertas do seu encarte. Você pode digitar, colar uma lista ou falar no microfone. Exemplo: "Arroz 5kg 29,90, Feijão 1kg 7,49, Leite Integral 1L 4,99"',
        },
      ]);
      setInput("");
      setBusy(false);
      setRecording(false);
    }
  }, [open]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function handleSubmit() {
    if (!open) return;
    const text = input.trim();
    if (!text || busy) return;

    const userMsg: Message = { id: newId(), role: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setBusy(true);

    try {
      const result = await parseOffers({ text });
      const items = toNewOffers(result.products ?? []);

      if (items.length === 0) {
        const errMsg: Message = {
          id: newId(),
          role: "assistant",
          text: 'Não consegui identificar ofertas no texto. Tente descrever cada produto com nome e preço, por exemplo: "Pão de forma 500g 8,90, Manteiga 200g 12,49".',
        };
        setMessages((prev) => [...prev, errMsg]);
        setBusy(false);
        return;
      }

      const assistantMsg: Message = {
        id: newId(),
        role: "assistant",
        text: `Identifiquei ${items.length} oferta${items.length > 1 ? "s" : ""}. Organizando o encarte...`,
      };
      setMessages((prev) => [...prev, assistantMsg]);

      const { data, error } = await supabase
        .from("flyers")
        .insert({
          user_id: userId,
          title: "Novo encarte",
          template: "tradicional",
          format: "ig_feed",
          per_page: 8,
          pages: [{ id: newId(), items }] as unknown as FlyerPage[],
          settings: {
            headline: "OFERTAS DA SEMANA",
            subheadline: "Aproveite os melhores preços",
            fontScale: 1,
            showFooter: true,
          },
          status: "rascunho",
        })
        .select("id")
        .single();

      if (error) throw error;

      const successMsg: Message = {
        id: newId(),
        role: "assistant",
        text: `Pronto! Seu encarte com ${items.length} oferta${items.length > 1 ? "s" : ""} foi criado. Abrindo o editor...`,
      };
      setMessages((prev) => [...prev, successMsg]);

      setTimeout(() => {
        onOpenChange(false);
        onCreated(data.id);
      }, 1200);
    } catch (error) {
      const errMsg: Message = { id: newId(), role: "assistant", text: messageFor(error) };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setBusy(false);
    }
  }

  async function toggleRecording() {
    if (recording) {
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const candidates = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/ogg;codecs=opus",
      ];
      const mimeType = candidates.find(
        (c) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c),
      );
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) chunks.push(event.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        setRecording(false);
        if (chunks.length === 0) return;
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        setBusy(true);
        try {
          const audioBase64 = await blobToBase64(blob);
          setInput("(áudio gravado — transcreva as ofertas no campo acima)");
        } catch (err) {
          const errMsg: Message = { id: newId(), role: "assistant", text: messageFor(err) };
          setMessages((prev) => [...prev, errMsg]);
        } finally {
          setBusy(false);
        }
      };

      recorderRef.current = recorder;
      setRecording(true);
      recorder.start();
    } catch {
      const errMsg: Message = {
        id: newId(),
        role: "assistant",
        text: "Não foi possível acessar o microfone. Verifique a permissão do navegador.",
      };
      setMessages((prev) => [...prev, errMsg]);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg flex flex-col max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Criar encarte com IA
          </DialogTitle>
          <DialogDescription>
            Descreva as ofertas do seu encarte. Você pode digitar, colar uma lista ou usar o
            microfone.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3 min-h-0" style={{ maxHeight: "400px" }}>
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`rounded-xl px-4 py-2.5 text-sm max-w-[85%] ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}
          {busy && messages[messages.length - 1]?.role === "user" && (
            <div className="flex justify-start">
              <div className="rounded-xl px-4 py-2.5 text-sm bg-muted text-foreground flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Processando...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="space-y-2 pt-2 border-t border-border">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Descreva as ofertas... Ex: Arroz 5kg 29,90, Feijão 1kg 7,49, Leite 1L 4,99"
            rows={3}
            className="resize-none"
          />
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={recording ? "destructive" : "outline"}
              size="sm"
              className="gap-1.5"
              onClick={toggleRecording}
              disabled={busy}
            >
              {recording ? (
                <>
                  <Square className="h-3.5 w-3.5" />
                  Parar
                </>
              ) : (
                <>
                  <Mic className="h-3.5 w-3.5" />
                  Gravar voz
                </>
              )}
            </Button>
            <Button
              type="button"
              className="flex-1 gap-1.5"
              onClick={handleSubmit}
              disabled={busy || input.trim().length < 3}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {busy ? "Criando..." : "Criar encarte"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
