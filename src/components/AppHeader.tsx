import { Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";

export function AppHeader({
  titulo,
  subtitulo,
}: {
  titulo: string;
  subtitulo?: string;
}) {
  const { signedIn } = useAuth();

  return (
    <header className="mx-auto flex max-w-2xl items-end justify-between gap-4 px-5 pt-8 pb-6">
      <div>
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Blowmind
        </p>
        <h1 className="mt-1 font-display text-3xl leading-tight">{titulo}</h1>
        {subtitulo ? (
          <p className="mt-1 text-sm text-muted-foreground">{subtitulo}</p>
        ) : null}
      </div>
      {!signedIn ? (
        <Link
          to="/auth"
          className="shrink-0 rounded-full border border-border px-4 py-2 text-xs font-medium text-foreground"
        >
          Entrar
        </Link>
      ) : null}
    </header>
  );
}
