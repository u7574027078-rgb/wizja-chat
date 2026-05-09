import { Outlet, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div style={{ fontFamily: "system-ui", textAlign: "center", padding: "80px 20px" }}>
      <h1 style={{ fontSize: "72px", fontWeight: "700", color: "#1e1b4b" }}>404</h1>
      <p style={{ color: "#64748b", marginTop: "8px" }}>Strona nie istnieje.</p>
      <a href="/" style={{ display: "inline-block", marginTop: "24px", padding: "10px 24px", background: "#6366f1", color: "white", borderRadius: "10px", textDecoration: "none", fontSize: "14px" }}>
        Wróć do strony głównej
      </a>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Wizja AI – Twój asystent" },
      { name: "description", content: "Wizja AI – inteligentny asystent gotowy do pomocy" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <head>
        <HeadContent />
      </head>
      <body style={{ margin: 0 }}>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return <Outlet />;
}
