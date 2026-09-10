// Shared /v2 theme: tokens (light+dark), switchable accent, wireframe
// frame, fonts — consumed by /v2 (LandingV2) and /app-v2 (AppV2Layout).

export const V2_CSS = `@import url('https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800&family=Geist+Mono:wght@400;500&display=swap');

.v2scope{
  --background:68 0% 96%; --foreground:200 14% 4%;
  --card:63 100% 100%; --card-foreground:200 14% 4%;
  --popover:63 100% 100%; --popover-foreground:200 14% 4%;
  --primary:69 0% 24%; --primary-foreground:150 0% 93%;
  --secondary:240 18% 98%; --secondary-foreground:240 6% 10%;
  --muted:68 0% 92%; --muted-foreground:120 0% 46%;
  --accent:60 0% 92%; --accent-foreground:223 38% 15%;
  --border:68 0% 90%; --input:69 0% 95%; --ring:0 0% 0%;
  --radius:0rem;
  --success:152 55% 30%;
  --v2a:45 93% 47%; --v2ai:25 90% 36%;
  /* bklit chart tokens (stone scale, light) — dieselbe Art, Akzente zu setzen */
  --chart-1:30 6% 25%; --chart-2:25 5% 45%; --chart-3:24 3% 65%;
  --chart-4:24 6% 84%; --chart-5:60 5% 96%;
  background:hsl(var(--background)); color:hsl(var(--foreground));
}
html.dark .v2scope{
  --background:221 15% 4%; --foreground:180 20% 98%;
  --card:225 12% 6%; --card-foreground:180 20% 98%;
  --popover:227 12% 12%; --popover-foreground:180 20% 98%;
  --primary:192 11% 90%; --primary-foreground:197 13% 10%;
  --secondary:227 12% 15%; --secondary-foreground:180 20% 98%;
  --muted:230 12% 19%; --muted-foreground:224 8% 54%;
  --accent:229 12% 18%; --accent-foreground:180 20% 98%;
  --border:224 12% 16%; --input:224 12% 16%; --ring:225 84% 60%;
  --success:145 50% 45%;
  --v2a:45 93% 47%; --v2ai:43 96% 60%;
  /* bklit chart tokens (zinc scale, dark) */
  --chart-1:240 4% 16%; --chart-2:240 5% 34%; --chart-3:240 4% 46%;
  --chart-4:240 5% 65%; --chart-5:240 5% 84%;
}
.v2scope[data-acc="lila"]{ --v2a:239 84% 67%; --v2ai:243 75% 50%; }
html.dark .v2scope[data-acc="lila"]{ --v2a:239 84% 67%; --v2ai:234 89% 74%; }
/* Graphit = bklits Mono-Akzent, direkt aus den chart tokens */
.v2scope[data-acc="mono"]{ --v2a:var(--chart-2); --v2ai:var(--chart-1); }
html.dark .v2scope[data-acc="mono"]{ --v2a:var(--chart-4); --v2ai:var(--chart-5); }
/* Forest = bklits Teal-Skala auf --chart-1…5, Akzent daraus abgeleitet */
.v2scope[data-acc="forest"]{
  --chart-1:176 69% 22%; --chart-2:175 84% 32%; --chart-3:173 80% 40%;
  --chart-4:172 66% 50%; --chart-5:168 84% 78%;
  --v2a:var(--chart-3); --v2ai:var(--chart-1);
}
html.dark .v2scope[data-acc="forest"]{
  --chart-1:175 77% 26%; --chart-2:175 84% 32%; --chart-3:173 80% 40%;
  --chart-4:172 66% 50%; --chart-5:171 77% 64%;
  --v2a:var(--chart-3); --v2ai:var(--chart-4);
}
/* Lagoon = bklits Cyan-Skala, gleiche Mechanik */
.v2scope[data-acc="lagoon"]{
  --chart-1:194 70% 27%; --chart-2:192 91% 36%; --chart-3:189 94% 43%;
  --chart-4:188 86% 53%; --chart-5:186 94% 82%;
  --v2a:var(--chart-3); --v2ai:var(--chart-1);
}
html.dark .v2scope[data-acc="lagoon"]{
  --chart-1:193 82% 31%; --chart-2:192 91% 36%; --chart-3:189 94% 43%;
  --chart-4:188 86% 53%; --chart-5:187 92% 69%;
  --v2a:var(--chart-3); --v2ai:var(--chart-4);
}
/* App skin: primary actions follow the selected accent throughout the product.
   (dark needs its own selector — html.dark .v2scope has higher specificity) */
.v2scope[data-app-v2]{
  --primary:var(--v2a);
  --primary-foreground:200 14% 4%;
  --ring:var(--v2a);
  --accent:var(--v2a);
  --accent-foreground:200 14% 4%;
}
html.dark .v2scope[data-app-v2]{
  --primary:var(--v2a);
  --primary-foreground:200 14% 4%;
  --ring:var(--v2a);
  --accent:var(--v2a);
  --accent-foreground:200 14% 4%;
}
.v2a{ color:hsl(var(--v2ai)); }
.v2ab{ background-color:hsl(var(--v2a)); }
.v2aglow{ background-color:hsl(var(--v2a) / .15); }
.v2scope ::selection{ background:hsl(var(--v2a)); color:#fff; }
.v2dots{
  background-image:radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0);
  background-size:22px 22px;
}
.v2caret{ animation:v2blink 1.06s step-end infinite; }
@keyframes v2blink{ 0%,100%{opacity:1} 50%{opacity:0} }
@media (prefers-reduced-motion: reduce){ .v2caret{ animation:none } }
.v2node{ border:1px solid hsl(var(--border)); background:hsl(var(--card)); }
.v2node-on{
  border-color:hsl(var(--v2a));
  background:hsl(var(--background));
  box-shadow:0 0 0 1px hsl(var(--v2a) / .45), 0 0 28px -8px hsl(var(--v2a) / .55);
}
.v2edge{ position:relative; display:block; background:hsl(var(--border)); }
.v2edge > span{ position:absolute; inset:0; display:block; background:hsl(var(--v2a)); transform:scaleX(0); transform-origin:left center; }
.v2edge-done > span{ transform:none; }
/* Loading-Bar: Dauer muss zu STEP_MS unten passen */
.v2edge-run > span{ animation:v2load 3.6s linear forwards; }
@keyframes v2load{ from{ transform:scaleX(0); } to{ transform:scaleX(1); } }
.v2paused .v2edge-run > span{ animation-play-state:paused; }
@media (max-width:1023.5px){
  .v2edge > span{ transform:scaleY(0); transform-origin:center top; }
  .v2edge-run > span{ animation-name:v2loadY; }
  @keyframes v2loadY{ from{ transform:scaleY(0); } to{ transform:scaleY(1); } }
}
@media (prefers-reduced-motion: reduce){ .v2edge-run > span{ animation:none } }
html:not(.dark) .v2scope .v2fx{ opacity:.45; filter:saturate(.8) brightness(1.05); }

/* Geist / Geist Mono — same fonts as the reference portfolio */
.v2scope{ font-family:'Geist',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; }
.v2scope .font-mono{ font-family:'Geist Mono',ui-monospace,SFMono-Regular,Menlo,monospace; }
.v2scope h1,.v2scope h2,.v2scope h3,.v2scope h4,.v2scope .font-display{ font-family:'Geist',sans-serif; letter-spacing:-0.02em; }
.v2scope .font-editorial{ font-family:'Geist',sans-serif; font-weight:600; letter-spacing:-0.02em; }

/* bklit framed grid (gem-portfolio-2 /reference, SectionRulers + GridDots):
   1px border, 40px ruler lines crossing every corner (32px outside, 8px
   inside), 24px hatch squares TR/BL 32px outside, hairline cell grid,
   dots punched on the grid intersections. */
.v2wire{ position:relative; border:1px solid hsl(var(--border)); background:hsl(var(--card)); }
.v2rule{ position:absolute; pointer-events:none; background:hsl(var(--muted-foreground) / .4); }
.v2rule-tl-v{ top:-32px; left:0; width:1px; height:40px; }
.v2rule-tl-h{ top:0; left:-32px; width:40px; height:1px; }
.v2rule-tr-v{ top:-32px; right:0; width:1px; height:40px; }
.v2rule-tr-h{ top:0; right:-32px; width:40px; height:1px; }
.v2rule-bl-v{ bottom:-32px; left:0; width:1px; height:40px; }
.v2rule-bl-h{ bottom:0; left:-32px; width:40px; height:1px; }
.v2rule-br-v{ right:0; bottom:-32px; width:1px; height:40px; }
.v2rule-br-h{ right:-32px; bottom:0; width:40px; height:1px; }
.v2hatch{
  position:absolute; width:24px; height:24px; opacity:.8; pointer-events:none;
  background-image:repeating-linear-gradient(45deg,
    hsl(var(--muted-foreground) / .4) 0,
    hsl(var(--muted-foreground) / .4) 1px,
    transparent 0,
    transparent 50%);
  background-size:5px 5px;
  background-attachment:fixed;
}
.v2hatch-tr{ top:-32px; right:-32px; }
.v2hatch-bl{ bottom:-32px; left:-32px; }

/* grid intersection dots (bklit GridDots): 8px mobil, 12px ab 768px —
   centers stay on the intersections via the -5px overlay + translate trick */
.v2griddots{ pointer-events:none; position:absolute; inset:-5px; z-index:3; }
/* single dot row on the bottom border (grid-border-dots) */
.v2dotrow{ pointer-events:none; position:absolute; left:-5px; right:-5px; bottom:-5px; height:10px; z-index:3; }
.v2griddot{
  position:absolute; width:8px; height:8px; border:1px solid hsl(var(--border));
  border-radius:9999px; background:hsl(var(--card)); transform:translate(-50%,-50%);
}
/* Rechtsrahmen: etwas kleinere, grau gefüllte Quadrate statt Kreise */
.v2gridsq{
  position:absolute; width:6px; height:6px; background:hsl(var(--muted-foreground) / .4);
  transform:translate(-50%,-50%);
}
@media (min-width:768px){
  .v2griddot{ width:12px; height:12px; }
  .v2gridsq{ width:9px; height:9px; }
}

/* About "expertise-card" variant: bordered card with the 13px reticle
   centered exactly on its border corners (comments / small cards). */
.v2ret{
  position:absolute; width:13px; height:13px; pointer-events:none; opacity:.55;
  color:hsl(var(--muted-foreground));
  background:
    linear-gradient(currentColor,currentColor) center/1px 100% no-repeat,
    linear-gradient(currentColor,currentColor) center/100% 1px no-repeat;
}
.v2ret.tl{ top:-7px; left:-7px; }
.v2ret.tr{ top:-7px; right:-7px; }
.v2ret.bl{ bottom:-7px; left:-7px; }
.v2ret.br{ bottom:-7px; right:-7px; }
.v2cross{
  position:relative; border:1px solid hsl(var(--border)); background:hsl(var(--card));
  transition:border-color .25s ease;
}
.v2cross:hover{ border-color:hsl(var(--foreground) / .4); }
`;
