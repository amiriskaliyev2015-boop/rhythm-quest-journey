import { createFileRoute } from "@tanstack/react-router";
import GeometryGame from "@/components/GeometryGame";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Geo Rush — 11 Level Rhythm Runner" },
      {
        name: "description",
        content:
          "Geo Rush — a Geometry Dash-inspired rhythm runner with 11 procedurally crafted levels, ~3 minutes each, getting harder as you go.",
      },
      { property: "og:title", content: "Geo Rush — 11 Level Rhythm Runner" },
      {
        property: "og:description",
        content:
          "Jump, fly and survive across 11 escalating levels. Space or tap to jump.",
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
  return <GeometryGame />;
}
