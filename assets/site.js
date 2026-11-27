// amazedsaints.com: letterbox on scroll, golden dust in the light,
// scroll reveals, a little parallax, and music only when asked for.
(() => {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const nav = document.querySelector(".nav");
  const hero = document.querySelector(".hero");
  const bars = document.querySelectorAll(".bar");
  const phones = document.querySelectorAll(".phone[data-depth]");

  // Letterbox bars open up as you scroll out of the opening shot; the nav turns solid.
  let ticking = false;
  const onScroll = () => {
    ticking = false;
    const y = scrollY;
    const h = hero.offsetHeight;
    const k = Math.min(1, y / (h * 0.5));
    bars.forEach(b => (b.style.transform = `scaleY(${1 - k})`));
    nav.classList.toggle("solid", y > h * 0.6);
    if (!reduced) {
      const vh = innerHeight;
      phones.forEach(p => {
        const r = p.getBoundingClientRect();
        const off = (r.top + r.height / 2 - vh / 2) * parseFloat(p.dataset.depth);
        p.style.transform = `translateY(${off.toFixed(1)}px)`;
      });
    }
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
