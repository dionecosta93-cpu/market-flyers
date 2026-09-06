import { useEffect, useRef, useState } from 'react';
import { Loader2, Mic, Square, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { correctOffers, parseOffers, transcribeOffers } from '@/lib/ai.functions';
import { newId, type Offer } from '@/lib/flyer-types';

type OfferImportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offers: Offer[];
  onAddMany: (items: Offer[]) => void;
  onReplaceAll: (items: Offer[]) => void;
};

type Message = { type: 'ok' | 'err'; text: string };

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64 || '');
    };
    reader.onerror = () => reject(reader.error ?? new Error('Não foi possível ler o áudio.'));
    reader.readAsDataURL(blob);
  });
}

function toNewOffers(items: any[]): Offer[] {
  return items.map((item) => ({
    id: newId(),
    name: String(item?.name ?? 'Produto').trim() || 'Produto',
    brand: typeof item?.brand === 'string' ? item.brand.trim() : '',
    size: typeof item?.size === 'string' ? item.size.trim() : '',
    price: Number(item?.price) || 0,
    oldPrice: item?.oldPrice == null ? null : Number(item.oldPrice),
    category: typeof item?.category === 'string' ? item.category : 'Outros',
    qty: typeof item?.qty === 'string' ? item.qty : '',
  }));
}

function messageFor(error: unknown): Message {
  return {
    type: 'err',
    text: error instanceof Error ? error.message : 'Não foi possível concluir. Tente novamente.',
  };
}

export function OfferImportDialog({
  open,
  onOpenChange,
  offers,
  onAddMany,
  onReplaceAll,
}: OfferImportDialogProps) {
  const [activeTab, setActiveTab] = useState<'texto' | 'voz' | 'comando'>('texto');
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  useEffect(() => {
    if (!open) {
      setActiveTab('texto');
      setDraft('');
      setMessage(null);
      setBusy(false);
      setRecording(false);
    }
  }, [open]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function handleOpenChange(next: boolean) {
    if (!next) {
      if (recording && recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
    }
    onOpenChange(next);
  }

  async function addImportedFromDraft() {
    const text = draft.trim();
    if (text.length < 3) {
      setMessage({ type: 'err', text: 'Escreva ou fale as ofertas antes de extrair.' });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const result = await parseOffers({ data: { text } });
      const items = toNewOffers(result.products ?? []);
      if (items.length === 0) {
        throw new Error('Não identifiquei ofertas no texto. Tente de outra forma.');
      }
      const plural = items.length > 1 ? 's' : '';
      onAddMany(items);
      setDraft('');
      setMessage({ type: 'ok', text: `${items.length} oferta${plural} adicionada${plural} à página.` });
    } catch (error) {
      setMessage(messageFor(error));
    } finally {
      setBusy(false);
    }
  }

  async function applyCommand() {
    const command = draft.trim();
    if (command.length < 3) {
      setMessage({ type: 'err', text: 'Descreva a correção que deseja aplicar.' });
      return;
    }
    if (offers.length === 0) {
      setMessage({ type: 'err', text: 'Esta página ainda não tem ofertas para corrigir.' });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const payload = offers.map((offer) => ({
        id: offer.id,
        name: offer.name,
        brand: offer.brand || '',
        size: offer.size || '',
        price: Number(offer.price) || 0,
        oldPrice: offer.oldPrice ?? null,
        category: offer.category || '',
        qty: offer.qty || '',
      }));
      const result = await correctOffers({ data: { command, products: payload } });
      const source = Array.isArray(result.products) ? result.products : [];
      if (source.length === 0) {
        throw new Error('A correção não retornou produtos válidos.');
      }
      const nextOffers: Offer[] = source.map((item: any) => {
        const known = offers.find((offer) => offer.id === item?.id);
        const fallback: Partial<Offer> = known ?? {};
        return {
          ...(known ? { ...known } : {}),
          id: known?.id ?? newId(),
          name: String(item?.name ?? fallback.name ?? 'Produto').trim() || 'Produto',
          brand: typeof item?.brand === 'string' ? item.brand : typeof fallback.brand === 'string' ? fallback.brand : '',
          size: typeof item?.size === 'string' ? item.size : typeof fallback.size === 'string' ? fallback.size : '',
          price: Number(item?.price ?? fallback.price) || 0,
          oldPrice: item?.oldPrice !== undefined && item?.oldPrice !== null ? Number(item.oldPrice) : (known?.oldPrice ?? null),
          category: typeof item?.category === 'string' ? item.category : typeof fallback.category === 'string' ? fallback.category : 'Outros',
          qty: typeof item?.qty === 'string' ? item.qty : typeof fallback.qty === 'string' ? fallback.qty : '',
          highlight: !!known?.highlight,
        };
      });
      onReplaceAll(nextOffers);
      setDraft('');
      setMessage({ type: 'ok', text: 'Correção aplicada à página.' });
    } catch (error) {
      setMessage(messageFor(error));
    } finally {
      setBusy(false);
    }
  }

  async function toggleRecording() {
    if (recording) {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
      }
      return;
    }

    setMessage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
      const mimeType = candidates.find((candidate) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(candidate));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = [];
      const modeAtStart = activeTabRef.current;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) chunks.push(event.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        setRecording(false);
        if (chunks.length === 0) {
          setMessage({ type: 'err', text: 'Nenhum áudio foi captado. Tente novamente.' });
          return;
        }
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        setBusy(true);
        try {
          const audioBase64 = await blobToBase64(blob);
          const format = blob.type.includes('mp4') ? 'mp4' : 'webm';
          const transcription = await transcribeOffers({ data: { audioBase64, format } });
          const text = (transcription.text || '').trim();
          if (!text) {
            throw new Error('Transcrevi o áudio, mas não consegui ler as ofertas. Tente falar mais devagar.');
          }
          setDraft(text);
          if (modeAtStart === 'comando') {
            setActiveTab('comando');
            setMessage({ type: 'ok', text: 'Comando transcrito. Revise e clique em Aplicar correção.' });
          } else {
            setActiveTab('texto');
            setMessage({ type: 'ok', text: 'Áudio transcrito. Revise o texto antes de adicionar as ofertas.' });
          }
        } catch (error) {
          setMessage(messageFor(error));
        } finally {
          setBusy(false);
        }
      };

      recorderRef.current = recorder;
      setRecording(true);
      recorder.start();
    } catch (error) {
      setMessage({ type: 'err', text: 'Não foi possível acessar o microfone. Verifique a permissão do navegador.' });
    }
  }

  const actionDisabled = busy || draft.trim().length < 3;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>Adicionar ofertas com IA</DialogTitle>
          <DialogDescription>
            Digite, cole ou fale as ofertas. A IA identifica os produtos e preços e adiciona à página atual do encarte.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(value) => {
            setActiveTab(value as 'texto' | 'voz' | 'comando');
            setMessage(null);
          }}
        >
          <TabsList className='grid w-full grid-cols-3'>
            <TabsTrigger value='texto'>Texto</TabsTrigger>
            <TabsTrigger value='voz'>Voz</TabsTrigger>
            <TabsTrigger value='comando'>Corrigir</TabsTrigger>
          </TabsList>
          <TabsContent value='texto' className='mt-2 text-sm text-muted-foreground'>
            Cole aqui uma lista digitada, como: arroz 5kg 29,90, feijão 1kg 7,49, óleo de soja 900ml 6,99.
          </TabsContent>
          <TabsContent value='voz' className='mt-2 text-sm text-muted-foreground'>
            Toque em Gravar áudio e fale as ofertas. O áudio será transcrito abaixo para você revisar antes de adicionar.
          </TabsContent>
          <TabsContent value='comando' className='mt-2 text-sm text-muted-foreground'>
            Descreva uma correção para as ofertas desta página, como: renomeie arroz para Arroz Tipo 1 e troque o preço para 27,90.
          </TabsContent>
        </Tabs>

        <div className='space-y-3'>
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={
              activeTab === 'comando'
                ? 'Exemplo: corrija o segundo item para Feijão Carioca 1kg por 6,49'
                : 'Exemplo: Leite Integral 1L 4,99, Café 500g 18,90, Detergente 900ml 2,79'
            }
            rows={5}
            className='resize-none'
          />

          {message && (
            <p
              className={message.type === 'err' ? 'rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive' : 'rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary'}
            >
              {message.text}
            </p>
          )}

          <div className='flex flex-col gap-2 sm:flex-row'>
            <Button
              type='button'
              variant={recording ? 'destructive' : 'outline'}
              className='gap-2'
              onClick={toggleRecording}
              disabled={busy}
            >
              {recording ? (<><Square className='h-4 w-4' /> Parar gravação</>) : (<><Mic className='h-4 w-4' /> Gravar áudio</>)}
            </Button>

            {activeTab === 'comando' ? (
              <Button type='button' className='flex-1 gap-2' onClick={applyCommand} disabled={actionDisabled}>
                {busy ? <Loader2 className='h-4 w-4 animate-spin' /> : <Wand2 className='h-4 w-4' />}
                Aplicar correção
              </Button>
            ) : (
              <Button type='button' className='flex-1 gap-2' onClick={addImportedFromDraft} disabled={actionDisabled}>
                {busy ? <Loader2 className='h-4 w-4 animate-spin' /> : <Wand2 className='h-4 w-4' />}
                Extrair e adicionar
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
