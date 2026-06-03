import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import GeometryGame from "@/components/GeometryGame";
import { AuthBadge } from "@/components/AuthBadge";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PRISM RUSH — 15 Level Shape Runner" },
      {
        name: "description",
        content:
          "PRISM RUSH — a neon shape-runner with 15 procedurally crafted levels. Pilot gems, stars, rockets, rhombs and bolts through escalating obstacles.",
      },
      { property: "og:title", content: "PRISM RUSH — 15 Level Shape Runner" },
      {
        property: "og:description",
        content:
          "Pilot 5 distinct shapes across 15 escalating neon levels. Tap or space to act.",
      },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;900&display=swap",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuthed(!!session);
      setChecked(true);
      if (!session) navigate({ to: "/auth", replace: true });
    });
    supabase.auth.getSession().then(({ data }) => {
      setAuthed(!!data.session);
      setChecked(true);
      if (!data.session) navigate({ to: "/auth", replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  if (!checked || !authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <p className="text-sm opacity-70">Загрузка...</p>
      </div>
    );
  }

  return (
    <>
      <AuthBadge />
      <GeometryGame />
    </>
  );
}
