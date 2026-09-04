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
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-3">
            <ShoppingBag className="w-6 h-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Market Flyers</CardTitle>
          <CardDescription>
            Acesse sua conta para criar e editar encartes de ofertas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-1 mb-6">
            <Button
              type="button"
              variant={mode === "login" ? "default" : "ghost"}
              size="sm"
              className="w-32"
              onClick={() => {
                setMode("login");
                setPlainError(null);
                setNotice(null);
              }}
            >
              Entrar
            </Button>
            <Button
              type="button"
              variant={mode === "signup" ? "default" : "ghost"}
              size="sm"
              className="w-32"
              onClick={() => {
                setMode("signup");
                setPlainError(null);
                setNotice(null);
              }}
            >
              Criar conta
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="auth-name">Seu nome</Label>
                <Input
                  id="auth-name"
                  placeholder="Maria da Silva"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="auth-email">E-mail</Label>
              <Input
                id="auth-email"
                type="email"
                placeholder="voce@exemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="auth-password">Senha</Label>
              <Input
                id="auth-password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                required
              />
            </div>

            {plainError && (
              <div className="rounded-lg bg-destructive/10 text-destructive px-3 py-2 text-sm">
                {plainError}
              </div>
            )}
            {notice && (
              <div className="rounded-lg bg-emerald-100 text-emerald-800 px-3 py-2 text-sm">
                {notice}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {mode === "login" ? "Entrar" : "Criar conta gratuita"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
