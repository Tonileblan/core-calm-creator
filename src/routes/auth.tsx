import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar en Blowmind" },
      {
        name: "description",
        content:
          "Accede a Blowmind para guardar tus check-ins emocionales, meditaciones generadas con IA, alarmas y rachas de foco.",
      },
      { property: "og:title", content: "Entrar en Blowmind" },
      {
        property: "og:description",
        content: "Tu espacio de autorregulación, foco y meditaciones con IA.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { signedIn } = useAuth();
  const [modo, setModo] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (signedIn) void navigate({ to: "/" });
  }, [signedIn, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (modo === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Cuenta creada", {
          description: "Revisa tu correo si se pide confirmación.",
        });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se ha podido completar");
    } finally {
      setLoading(false);
    }
  };

  const google = async () => {
    const result = (await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    })) as { error?: unknown; redirected?: boolean };
    if (result.error) {
      toast.error("No se ha podido conectar con Google");
      return;
    }
    if (result.redirected) return;
    void navigate({ to: "/" });
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-12">
      <div className="mb-8 text-center">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
          Blowmind
        </p>
        <h1 className="mt-2 font-display text-3xl text-gradient">
          {modo === "login" ? "Vuelve a tu centro" : "Empieza a respirar mejor"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Guarda tus check-ins, meditaciones y rachas.
        </p>
      </div>

      <div className="surface-panel space-y-5 p-6">
        <Button
          variant="secondary"
          className="w-full rounded-full"
          onClick={() => void google()}
        >
          Continuar con Google
        </Button>

        <div className="flex items-center gap-3 text-[0.7rem] uppercase tracking-widest text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> o <span className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Correo</Label>
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={6}
              autoComplete={modo === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full rounded-full" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {modo === "login" ? "Entrar" : "Crear cuenta"}
          </Button>
        </form>

        <button
          className="w-full text-center text-xs text-muted-foreground underline"
          onClick={() => setModo(modo === "login" ? "signup" : "login")}
        >
          {modo === "login"
            ? "No tengo cuenta todavía"
            : "Ya tengo cuenta, quiero entrar"}
        </button>
      </div>
    </div>
  );
}
