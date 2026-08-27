import { Link } from "@tanstack/react-router";
import { Home, Wind, Music, Sparkles, User } from "lucide-react";

const items = [
  { to: "/", label: "Inicio", icon: Home },
  { to: "/respiracion", label: "Respirar", icon: Wind },
  { to: "/audio", label: "Audio", icon: Music },
  { to: "/laboratorio", label: "Lab IA", icon: Sparkles },
  { to: "/perfil", label: "Perfil", icon: User },
] as const;

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-surface/85 backdrop-blur-xl">
      <ul className="mx-auto flex max-w-2xl items-stretch justify-between px-2 pb-[env(safe-area-inset-bottom)]">
        {items.map(({ to, label, icon: Icon }) => (
          <li key={to} className="flex-1">
            <Link
              to={to}
              activeOptions={{ exact: to === "/" }}
              className="flex flex-col items-center gap-1 py-3 text-[0.68rem] font-medium text-muted-foreground transition-colors"
              activeProps={{ className: "!text-primary" }}
            >
              <Icon className="h-5 w-5" strokeWidth={1.8} />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
