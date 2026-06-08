import { createFileRoute } from "@tanstack/react-router";
import GeometryGame from "@/components/GeometryGame";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PRISM RUSH - 15 Level Shape Runner" },
      {
        name: "description",
        content:
          "PRISM RUSH - a neon shape-runner with 15 procedurally crafted levels. Pilot gems, stars, rockets, rhombs and bolts through escalating obstacles.",
      },
      { property: "og:title", content: "PRISM RUSH - 15 Level Shape Runner" },
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
  return <GeometryGame />;
}
