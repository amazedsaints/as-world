// amazedsaints.com: letterbox on scroll, golden dust in the light,
// scroll reveals, a little parallax, and music only when asked for.
(() => {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const nav = document.querySelector(".nav");
  const hero = document.querySelector(".hero");
  const bars = document.querySelectorAll(".bar");
  const phones = document.querySelectorAll(".phone[data-depth]");

  // The fly-through: 96 frames of the camera gliding through the barn doors,
  // drawn on a canvas and scrubbed by the scroll position while the hero is
  // pinned. Frames load after the first one is on screen, nearest first.
  const track = document.querySelector(".hero-scroll");
  const ui = document.querySelector(".hero-ui");
  const fly = document.querySelector(".fly");
  const shade = document.querySelector(".hero-shade");
  const floor = document.querySelector(".hero-floor");
  const motesEl = document.querySelector(".motes");
  const FRAMES = 96;
  const set = matchMedia("(min-aspect-ratio: 1/1)").matches ? "wide" : "tall";
  const frames = new Array(FRAMES);
  let shown = -1, wanted = 0, fctx = null;
  const src = i => `/assets/fly2/${set}/${String(i).padStart(3, "0")}.webp`;
  const sizeFly = () => {
    if (!fly) return;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    fly.width = Math.round(fly.clientWidth * dpr);
    fly.height = Math.round(fly.clientHeight * dpr);
    shown = -1; paint();
  };
  const paint = () => {
    if (!fctx) return;
    // the wanted frame, or the nearest one that has loaded
    let i = wanted, d = 0;
    while (d < FRAMES) {
      if (frames[wanted - d] && frames[wanted - d].complete && frames[wanted - d].naturalWidth) { i = wanted - d; break; }
      if (frames[wanted + d] && frames[wanted + d].complete && frames[wanted + d].naturalWidth) { i = wanted + d; break; }
      d++;
    }
    if (d >= FRAMES || i === shown) return;
    const im = frames[i], cw = fly.width, ch = fly.height;
    const s = Math.max(cw / im.naturalWidth, ch / im.naturalHeight);
    const w = im.naturalWidth * s, h = im.naturalHeight * s;
    fctx.drawImage(im, (cw - w) / 2, (ch - h) / 2, w, h);
    shown = i;
    fly.classList.add("ready");
  };
  if (fly && !reduced) {
    fctx = fly.getContext("2d");
    const load = i => new Promise(res => {
      const im = new Image();
      im.decoding = "async";
      im.onload = im.onerror = () => { paint(); res(); };
      im.src = src(i);
      frames[i] = im;
    });
    // every 8th frame first (a rough run of the whole move), then the rest in order
    const order = [];
    for (let i = 0; i < FRAMES; i += 8) order.push(i);
    for (let i = 0; i < FRAMES; i++) if (i % 8) order.push(i);
    (async () => {
      await load(0);
      sizeFly();
      const pool = 4;
      let next = 1;
      const worker = async () => { while (next < order.length) await load(order[next++]); };
      await Promise.all(Array.from({ length: pool }, worker));
    })();
    addEventListener("resize", sizeFly);
  }

  // Scroll: the letterbox bars open, the title fades as the camera starts
  // moving, the frames follow the scroll, the nav turns solid past the hero.
  let ticking = false;
  const onScroll = () => {
    ticking = false;
    const y = scrollY;
    const vh = innerHeight;
    const span = Math.max(1, track.offsetHeight - vh);
    const t = Math.min(1, Math.max(0, y / span));
    const k = Math.min(1, t / 0.12);
    bars.forEach(b => (b.style.transform = `scaleY(${1 - k})`));
    if (!reduced) {
      const fade = Math.min(1, Math.max(0, (t - 0.03) / 0.2));
      ui.style.opacity = (1 - fade).toFixed(3);
      ui.style.transform = `translateY(${(-fade * 40).toFixed(1)}px) scale(${(1 + fade * 0.04).toFixed(4)})`;
      ui.style.pointerEvents = fade > 0.6 ? "none" : "";
      // the dark shading behind the title lifts as the light takes over
      shade.style.opacity = (1 - Math.min(1, Math.max(0, (t - 0.1) / 0.45))).toFixed(3);
      if (motesEl) motesEl.style.opacity = (1 - Math.min(1, Math.max(0, (t - 0.6) / 0.3))).toFixed(3);
      // the last frame (inside the barn) holds for the final stretch while its floor fades to the page
      wanted = Math.round(Math.min(1, Math.max(0, (t - 0.04) / 0.84)) * (FRAMES - 1));
      if (floor) floor.style.opacity = Math.min(1, Math.max(0, (t - 0.84) / 0.16)).toFixed(3);
      paint();
      phones.forEach(p => {
        const r = p.getBoundingClientRect();
        const off = (r.top + r.height / 2 - vh / 2) * parseFloat(p.dataset.depth);
        p.style.transform = `translateY(${off.toFixed(1)}px)`;
      });
    }
    nav.classList.toggle("solid", y > span + vh * 0.3);
  };
  addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();

  // Scroll reveals.
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
  }, { threshold: 0.15, rootMargin: "0px 0px -6% 0px" });
  document.querySelectorAll(".reveal").forEach(el => io.observe(el));

  // Golden dust drifting through the evening light (stops when the hero is off screen).
  const canvas = document.querySelector(".motes");
  if (canvas && !reduced) {
    const ctx = canvas.getContext("2d");
    let w = 0, h = 0, dpr = 1, motes = [], running = true, last = 0;
    const size = () => {
      dpr = Math.min(devicePixelRatio || 1, 2);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(Math.min(90, (w * h) / 16000));
      motes = Array.from({ length: n }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        r: 0.6 + Math.random() * 1.9,
        vx: 0.05 + Math.random() * 0.25, vy: -0.05 - Math.random() * 0.18,
        a: 0.15 + Math.random() * 0.55, t: Math.random() * 6.28,
      }));
    };
    const draw = now => {
      if (!running) return;
      const dt = Math.min(50, now - (last || now)); last = now;
      ctx.clearRect(0, 0, w, h);
      for (const m of motes) {
        m.t += dt * 0.0012;
        m.x += m.vx * dt * 0.06 + Math.sin(m.t) * 0.15;
        m.y += m.vy * dt * 0.06;
        if (m.x > w + 5) m.x = -5;
        if (m.y < -5) { m.y = h + 5; m.x = Math.random() * w; }
        const glow = m.a * (0.6 + 0.4 * Math.sin(m.t * 1.7));
        ctx.beginPath();
        ctx.fillStyle = `rgba(255, 214, 140, ${glow.toFixed(3)})`;
        ctx.arc(m.x, m.y, m.r, 0, 6.283);
        ctx.fill();
      }
      requestAnimationFrame(draw);
    };
    size();
    addEventListener("resize", size);
    new IntersectionObserver(([e]) => {
      const was = running; running = e.isIntersecting;
      if (running && !was) { last = 0; requestAnimationFrame(draw); }
    }).observe(hero);
    requestAnimationFrame(draw);
  }

  // Arrow buttons for the worlds strip (it also scrolls by swipe, wheel and keys).
  const strip = document.querySelector(".strip");
  document.querySelectorAll(".strip-btn").forEach(b => b.addEventListener("click", () => {
    const card = strip.querySelector(".chapter");
    const step = card ? card.getBoundingClientRect().width + 20 : 300;
    strip.scrollBy({ left: step * 2 * Number(b.dataset.dir), behavior: reduced ? "auto" : "smooth" });
  }));

  // Music: off until the visitor turns it on; fades in and out.
  const btn = document.querySelector(".sound");
  const audio = document.querySelector(".music");
  const label = btn.querySelector(".sound-label");
  let fade = null;
  const ramp = (to, done) => {
    clearInterval(fade);
    fade = setInterval(() => {
      const v = audio.volume + (to > audio.volume ? 0.04 : -0.06);
      if ((to > audio.volume && v >= to) || (to <= audio.volume && v <= to)) {
        audio.volume = Math.max(0, Math.min(1, to)); clearInterval(fade); done && done();
      } else audio.volume = Math.max(0, Math.min(1, v));
    }, 60);
  };
  btn.addEventListener("click", () => {
    const on = btn.getAttribute("aria-pressed") !== "true";
    btn.setAttribute("aria-pressed", String(on));
    btn.setAttribute("aria-label", on ? "Turn sound off" : "Turn sound on");
    label.textContent = on ? "Sound on" : "Sound off";
    if (on) {
      audio.volume = 0;
      audio.play().then(() => ramp(0.55)).catch(() => {
        btn.setAttribute("aria-pressed", "false"); label.textContent = "Sound off";
      });
    } else {
      ramp(0, () => audio.pause());
    }
  });
})();
