import { Link, useRouter } from "@tanstack/react-router";
import { Home, Wind, Music, Sparkles, Timer, User } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/", label: "Inicio", icon: Home },
  { to: "/respiracion", label: "Respirar", icon: Wind },
  { to: "/audio", label: "Audio", icon: Music },
  { to: "/laboratorio", label: "Lab IA", icon: Sparkles },
  { to: "/gimnasio", label: "Foco", icon: Timer },
  { to: "/perfil", label: "Perfil", icon: User },
] as const;

export function BottomNav() {
  const router = useRouter();
  const currentPath = router.state.location.pathname;

  return (
    <nav className="shrink-0 w-full border-t border-border/80 bg-surface/90 backdrop-blur-2xl z-30 select-none touch-none">
      <ul className="mx-auto flex max-w-2xl items-stretch justify-between px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5">
        {items.map(({ to, label, icon: Icon }) => (
          <li key={to} className="flex-1">
            <Link
              to={to}
              activeOptions={{ exact: to === "/" }}
              className="flex flex-col items-center gap-1 py-1.5 text-[0.68rem] font-medium text-muted-foreground transition-colors active:scale-95"
              activeProps={{ className: "!text-primary font-semibold" }}
            >
              <Icon className="h-5 w-5" strokeWidth={1.9} />
              <span>{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
