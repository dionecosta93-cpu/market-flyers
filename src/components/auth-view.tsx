import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShoppingBag, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type MinimalSession = { user: { id: string; email?: string | null } } | null;

export function useAuthSession() {
  const [session, setSession] = useState<MinimalSession>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (mounted) {
        setSession(data.session);
        setAuthLoading(false);
      }
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setSession(session);
        setAuthLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription?.subscription.unsubscribe();
    };
  }, []);

  return { session, authLoading };
}

export function AuthView() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [plainError, setPlainError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPlainError(null);
    setNotice(null);

    if (!email.trim() || password.length < 6) {
      setPlainError("Informe um e-mail válido e uma senha com pelo menos 6 caracteres.");
      return;
    }

    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: name.trim() || null },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setNotice("Conta criada! Confirme o link enviado para o seu e-mail antes de entrar.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível fazer login.";
      setPlainError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-gray-100 to-slate-200 px-4 py-12">
      <Card className="w-full max-w-md shadow-xl bg-white border border-slate-200/80 rounded-2xl">
        <CardHeader className="text-center pb-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#d91a1a] via-[#b91c1c] to-[#991b1b] flex items-center justify-center mx-auto mb-3 shadow-lg shadow-red-500/25">
            <ShoppingBag className="w-7 h-7 text-white" />
          </div>
          <CardTitle className="text-2xl font-black tracking-tight text-slate-900">
            Market Flyers
          </CardTitle>
          <CardDescription className="text-slate-500 text-sm">
            Acesse sua conta para criar e editar encartes de ofertas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center p-1 bg-slate-100 rounded-xl mb-6 border border-slate-200/70">
            <button
              type="button"
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                mode === "login"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
              onClick={() => {
                setMode("login");
                setPlainError(null);
                setNotice(null);
              }}
            >
              Entrar
            </button>
            <button
              type="button"
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                mode === "signup"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
              onClick={() => {
                setMode("signup");
                setPlainError(null);
                setNotice(null);
              }}
            >
              Criar conta
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="auth-name" className="text-xs font-semibold text-slate-700">
                  Seu nome
                </Label>
                <Input
                  id="auth-name"
                  placeholder="Maria da Silva"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  className="bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:ring-[#d91a1a]/20 focus-visible:border-[#d91a1a] h-10"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="auth-email" className="text-xs font-semibold text-slate-700">
                E-mail
              </Label>
              <Input
                id="auth-email"
                type="email"
                placeholder="voce@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                className="bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:ring-[#d91a1a]/20 focus-visible:border-[#d91a1a] h-10"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="auth-password" className="text-xs font-semibold text-slate-700">
                Senha
              </Label>
              <Input
                id="auth-password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                required
                className="bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:ring-[#d91a1a]/20 focus-visible:border-[#d91a1a] h-10"
              />
            </div>

            {plainError && (
              <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-3.5 py-2.5 text-sm">
                {plainError}
              </div>
            )}
            {notice && (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 px-3.5 py-2.5 text-sm">
                {notice}
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 bg-gradient-to-r from-[#d91a1a] to-[#b91c1c] hover:from-[#b91c1c] hover:to-[#991b1b] text-white font-bold rounded-xl shadow-md shadow-red-600/20 transition-all text-sm"
              disabled={busy}
            >
              {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {mode === "login" ? "Entrar" : "Criar conta gratuita"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
