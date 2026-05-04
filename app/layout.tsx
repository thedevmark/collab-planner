import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/layout/AppShell";
import { headers } from "next/headers";

export const metadata: Metadata = {
  title: "Collab Planner",
  description: "Plan stream collabs with your Twitch friends",
  // Favicons are auto-registered from app/icon.svg and app/favicon.ico
  // (Venn-only, readable at 16/32/48px). /logo.svg is the wordmark for in-app use.
};

// Inline boot script: applies the saved theme-slider value (or the
// system fallback) to documentElement BEFORE React hydrates so the page
// never paints with the wrong tokens. Token pairs and storage key must
// match lib/themeSlider.ts exactly. If you edit either, edit both.
const THEME_BOOT = `(function(){try{
var KEY="collab-theme-t";
var raw=localStorage.getItem(KEY);
var t;
if(raw!==null){var n=Number(raw);t=isFinite(n)?Math.max(0,Math.min(1,n)):0;}
else if(window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches){t=1;}
else{t=0;}
var P=[
["--background",240,10,3.9,240,20,97],
["--foreground",0,0,98,240,6,12],
["--card",240,6,6,0,0,100],
["--card-foreground",0,0,98,240,6,12],
["--popover",240,6,6,0,0,100],
["--popover-foreground",0,0,98,240,6,12],
["--primary",221,83,73,221,83,53],
["--primary-foreground",240,10,4,0,0,100],
["--secondary",240,4,11,240,14,94],
["--secondary-foreground",0,0,98,240,6,12],
["--muted",240,4,11,240,14,94],
["--muted-foreground",240,4,65,240,4,42],
["--accent",240,4,15,240,12,91],
["--accent-foreground",0,0,98,240,6,12],
["--destructive",0,63,31,0,72,51],
["--destructive-foreground",0,0,98,0,0,100],
["--border",240,4,16,240,8,84],
["--input",240,4,16,240,8,84],
["--ring",221,83,73,221,83,53]
];
var r=document.documentElement;
function L(a,b){return a+(b-a)*t;}
for(var i=0;i<P.length;i++){var p=P[i];r.style.setProperty(p[0],L(p[1],p[4]).toFixed(1)+" "+L(p[2],p[5]).toFixed(1)+"% "+L(p[3],p[6]).toFixed(1)+"%");}
r.style.colorScheme=t<0.5?"dark":"light";
}catch(e){}})();`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? headersList.get("x-invoke-path") ?? "";
  const isAuthPage =
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/invite") ||
    pathname.startsWith("/privacy") ||
    pathname.startsWith("/terms");

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body className="antialiased">
        {isAuthPage ? children : <AppShell>{children}</AppShell>}
      </body>
    </html>
  );
}
