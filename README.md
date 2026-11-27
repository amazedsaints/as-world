# amazedsaints.com

The studio's portfolio site: a one-page, film-trailer style site featuring
Topplonium, plus the privacy policy that Google Play links to.

Plain static files, no build step:

- `index.html`, `assets/site.css`, `assets/site.js`: the page
- `assets/play.js`: the playful layer (launchers that fire cannonballs at
  the world cards, living posters, counting stats)
- `privacy.html`: privacy policy (served at `/privacy`; use
  `https://www.amazedsaints.com/privacy` in the Play Console)
- `404.html`, `robots.txt`, `sitemap.xml`, `_headers` (Cloudflare Pages headers)
- `assets/img/`: pictures from the game (WebP), `og.jpg` share image
- `assets/fly/wide/` and `assets/fly/tall/`: the 96 frames of the hero
  fly-through (the camera glides through the barn doors as you scroll),
  made by `tools/flythrough.py` from the Golden Hills painting
- `assets/logo/mark.png`: the logo (1024 px, transparent)
- `assets/img/poster-lumen-keeper.webp`, `poster-paper-skies.webp`,
  `poster-gravity-garden.webp`: concept paintings generated in the owner's
  Canva account
- `assets/audio/boom.mp3`: a cannon boom of our own (synthesized), heard
  only with sound on
- `assets/audio/barn-door-sunday.mp3`: the Golden Hills world track (made by
  the owner with Google Gemini); plays only when a visitor turns sound on

## Hosting on Cloudflare Pages

1. Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git →
   pick `amazedsaints/as-world`.
2. Build settings: framework preset **None**, build command **empty**, build
   output directory **/**. Production branch: `main`.
3. Custom domains: add `www.amazedsaints.com` and `amazedsaints.com`
   (Cloudflare adds the DNS records), then a redirect rule from the bare
   domain to `www` if wanted.
4. Web Analytics: in the Pages project → Metrics → Web Analytics → Enable.
   Cloudflare adds its cookieless beacon itself; nothing to change in the code.

Every push to `main` goes live; other branches get preview URLs.

## Previewing locally

```
python3 -m http.server 8080
```

then open http://localhost:8080.
