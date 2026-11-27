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

  // The logo in the nav spins along with the scroll (faster the faster you
  // scroll, backwards when you scroll up) and coasts to a stop.
  const brandSpin = document.querySelector(".brand-spin");
  let spinA = 0, spinV = 0, lastY = scrollY, spinning = false, spinT = 0;
  const spin = now => {
    const dt = Math.min(0.05, (now - (spinT || now)) / 1000); spinT = now;
    spinA = (spinA + spinV * dt * 6) % 360;
    spinV *= Math.pow(0.04, dt);
    if (brandSpin) brandSpin.style.transform = `rotate(${spinA.toFixed(1)}deg)`;
    if (Math.abs(spinV) > 0.5) requestAnimationFrame(spin); else { spinning = false; spinT = 0; }
  };

  // Sparks thrown off a logo ring (the nav logo on hover or tap, the footer
  // logo when the cannonball hits it).
  const COLS = ["#FFB547", "#FF5E7E", "#B45CFF", "#3FB8FF", "#2EE6A8"];
  const sparkle = (host, n = 12, reach = 34) => {
    if (reduced || !host) return;
    for (let i = 0; i < n; i++) {
      const sp = document.createElement("i");
      sp.className = "spark";
      const a = (i / n) * 6.283 + Math.random() * 0.4, d = reach * (0.6 + Math.random() * 0.7);
      sp.style.setProperty("--dx", `${(Math.cos(a) * d).toFixed(1)}px`);
      sp.style.setProperty("--dy", `${(Math.sin(a) * d).toFixed(1)}px`);
      sp.style.setProperty("--c", COLS[i % COLS.length]);
      sp.addEventListener("animationend", () => sp.remove());
      host.appendChild(sp);
    }
  };
  const brand = document.querySelector(".brand");
  if (brand) {
    brand.addEventListener("pointerenter", () => sparkle(brandSpin));
    brand.addEventListener("click", () => { sparkle(brandSpin, 16, 44); spinV += 260; if (!spinning) { spinning = true; requestAnimationFrame(spin); } });
  }

  // The footer logo topples: a cannonball rolls in and knocks it into the
  // air the first time it comes into view, and again on every tap.
  const foot = document.querySelector(".foot-brand");
  if (foot && !reduced) {
    const ring = foot.querySelector(".foot-ring");
    const topple = () => {
      foot.classList.remove("topple"); void foot.offsetWidth; foot.classList.add("topple");
      setTimeout(() => sparkle(ring, 10, 30), 330);
    };
    foot.addEventListener("click", topple);
    foot.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); topple(); } });
    foot.querySelector(".foot-hop").addEventListener("animationend", () => foot.classList.remove("topple"));
    new IntersectionObserver(([e], o) => { if (e.isIntersecting) { o.disconnect(); setTimeout(topple, 500); } }, { threshold: 1 }).observe(foot);
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
      wanted = Math.round(Math.min(1, Math.max(0, (t - 0.03) / 0.88)) * (FRAMES - 1));
      if (floor) floor.style.opacity = Math.min(1, Math.max(0, (t - 0.88) / 0.12)).toFixed(3);
      paint();
      phones.forEach(p => {
        const r = p.getBoundingClientRect();
        const off = (r.top + r.height / 2 - vh / 2) * parseFloat(p.dataset.depth);
        p.style.transform = `translateY(${off.toFixed(1)}px)`;
      });
    }
    nav.classList.toggle("solid", y > span + vh * 0.3);
    if (!reduced) { spinV += (y - lastY) * 0.9; lastY = y; if (!spinning) { spinning = true; requestAnimationFrame(spin); } }
  };
  addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();

  // Scroll reveals.
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
  }, { threshold: 0.06, rootMargin: "0px 0px -3% 0px" });
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

  // On a computer the worlds strip can be dragged with the mouse (click and
  // hold, move left or right); it glides on after you let go and settles
  // on a card.
  if (strip && matchMedia("(hover: hover) and (pointer: fine)").matches) {
    let down = false, sx = 0, sl = 0, moved = 0, v = 0, lx = 0, lt = 0, raf = 0;
    const settle = () => {
      const cards = [...strip.querySelectorAll(".chapter")];
      const pad = parseFloat(getComputedStyle(strip).paddingLeft) || 0;
      const best = cards.reduce((b, c) => Math.abs(c.offsetLeft - pad - strip.scrollLeft) < Math.abs(b - strip.scrollLeft) ? c.offsetLeft - pad : b, 0);
      strip.scrollTo({ left: best, behavior: reduced ? "auto" : "smooth" });
      setTimeout(() => strip.classList.remove("dragging"), 450);
    };
    strip.addEventListener("pointerdown", e => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      down = true; moved = 0; sx = lx = e.clientX; sl = strip.scrollLeft; lt = performance.now(); v = 0;
      cancelAnimationFrame(raf);
      strip.classList.add("dragging");
    });
    addEventListener("pointermove", e => {
      if (!down) return;
      const dx = e.clientX - sx;
      moved = Math.max(moved, Math.abs(dx));
      strip.scrollLeft = sl - dx;
      const now = performance.now();
      v = (e.clientX - lx) / Math.max(1, now - lt) * 16; lx = e.clientX; lt = now;
    });
    addEventListener("pointerup", () => {
      if (!down) return;
      down = false;
      if (moved < 6) { strip.classList.remove("dragging"); return; }
      let speed = -v;
      const glide = () => {
        strip.scrollLeft += speed; speed *= 0.92;
        if (Math.abs(speed) > 0.6) raf = requestAnimationFrame(glide); else settle();
      };
      raf = requestAnimationFrame(glide);
    });
    strip.addEventListener("click", e => { if (moved >= 6) { e.preventDefault(); e.stopPropagation(); } }, true);
    strip.addEventListener("dragstart", e => e.preventDefault());
  }

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
