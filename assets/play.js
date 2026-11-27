// amazedsaints.com, the playful layer: launchers that really fire (and knock
// the world cards about), living concept posters, and counting stats.
(() => {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const soundOn = () => document.querySelector(".sound")?.getAttribute("aria-pressed") === "true";
  const rand = (a, b) => a + Math.random() * (b - a);

  // ------------------------------------------------------------ cannons
  const fx = document.querySelector(".fx");
  const launchers = [...document.querySelectorAll(".launcher")];
  if (fx && launchers.length && !reduced) {
    const ctx = fx.getContext("2d");
    let W = 0, H = 0, dpr = 1, running = false, last = 0;
    const balls = [], puffs = [], sparks = [], flashes = [];
    const size = () => {
      dpr = Math.min(devicePixelRatio || 1, 2);
      W = innerWidth; H = innerHeight;
      fx.width = W * dpr; fx.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size();
    addEventListener("resize", size);

    const booms = Array.from({ length: 4 }, () => { const a = new Audio("/assets/audio/boom.mp3"); a.preload = "none"; return a; });
    let boomI = 0;
    const boom = (vol, rate) => {
      if (!soundOn()) return;
      const a = booms[boomI++ % booms.length];
      a.volume = vol; a.playbackRate = rate; a.currentTime = 0;
      a.play().catch(() => {});
    };

    const fire = btn => {
      const r = btn.getBoundingClientRect();
      if (r.bottom < 0 || r.top > H) return;
      const [mx, my] = btn.dataset.m.split(",").map(Number);
      let [dx, dy] = btn.dataset.d.split(",").map(Number);
      const x = r.left + r.width * mx / 100, y = r.top + r.height * my / 100;
      // on a narrow screen the shot is lobbed steeper, so it reaches the
      // world cards above before it runs out of screen
      const narrow = W < 700;
      if (narrow) { dx *= 0.42; const n = Math.hypot(dx, dy); dx /= n; dy /= n; }
      const speed = narrow ? 640 : Math.min(1050, Math.max(620, W * 0.75));
      balls.push({ x, y, vx: dx * speed, vy: dy * speed, g: speed * 0.62, r: Math.max(6, r.width * 0.1), life: 0, trail: [] });
      flashes.push({ x, y, t: 0, r: r.width * 0.55 });
      for (let i = 0; i < 9; i++) {
        const s = rand(40, 220);
        puffs.push({ x, y, vx: dx * s + rand(-50, 50), vy: dy * s + rand(-60, 20), r: rand(6, 14), grow: rand(18, 40), t: 0, life: rand(0.7, 1.4) });
      }
      for (let i = 0; i < 10; i++) {
        const s = rand(200, 520);
        sparks.push({ x, y, vx: dx * s + rand(-120, 120), vy: dy * s + rand(-120, 120), t: 0, life: rand(0.2, 0.5), c: "255, 205, 120" });
      }
      // the recoil: the launcher kicks back along its barrel
      btn.style.setProperty("--kx", `${(-dx * r.width * 0.09).toFixed(1)}px`);
      btn.style.setProperty("--ky", `${(-dy * r.width * 0.09).toFixed(1)}px`);
      btn.classList.remove("fire"); void btn.offsetWidth; btn.classList.add("fire");
      boom(0.5, rand(0.9, 1.15));
      if (!running) { running = true; last = 0; requestAnimationFrame(loop); }
    };

    const hit = (card, b) => {
      card.style.setProperty("--tilt", `${(b.vx > 0 ? 1 : -1) * rand(1.5, 3)}deg`);
      card.classList.remove("hit"); void card.offsetWidth; card.classList.add("hit");
      for (let i = 0; i < 16; i++) {
        const a = rand(0, 6.283), s = rand(60, 320);
        sparks.push({ x: b.x, y: b.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 80, t: 0, life: rand(0.3, 0.7), c: "255, 232, 190" });
      }
      for (let i = 0; i < 5; i++) puffs.push({ x: b.x, y: b.y, vx: rand(-60, 60), vy: rand(-80, -10), r: rand(5, 10), grow: rand(20, 36), t: 0, life: rand(0.5, 0.9) });
      flashes.push({ x: b.x, y: b.y, t: 0, r: b.r * 5 });
      boom(0.22, 1.7);
    };

    const loop = now => {
      const dt = Math.min(0.033, (now - (last || now)) / 1000); last = now;
      ctx.clearRect(0, 0, W, H);
      const cards = balls.length ? [...document.querySelectorAll(".chapter")].map(c => [c, c.getBoundingClientRect()]).filter(([, r]) => r.bottom > 0 && r.top < H && r.right > 0 && r.left < W) : [];
      for (let i = balls.length - 1; i >= 0; i--) {
        const b = balls[i];
        b.life += dt; b.vy += b.g * dt; b.x += b.vx * dt; b.y += b.vy * dt;
        b.trail.push([b.x, b.y]); if (b.trail.length > 10) b.trail.shift();
        let gone = b.y > H + 60 || b.x > W + 60 || b.x < -60;
        if (!gone && b.life > 0.06) {
          for (const [card, r] of cards) {
            if (b.x > r.left && b.x < r.right && b.y > r.top && b.y < r.bottom) { hit(card, b); gone = true; break; }
          }
        }
        if (gone) { balls.splice(i, 1); continue; }
        b.trail.forEach(([tx, ty], k) => {
          ctx.beginPath(); ctx.fillStyle = `rgba(255, 220, 160, ${(k / b.trail.length) * 0.22})`;
          ctx.arc(tx, ty, b.r * (0.4 + 0.6 * k / b.trail.length), 0, 6.283); ctx.fill();
        });
        const g = ctx.createRadialGradient(b.x - b.r * 0.35, b.y - b.r * 0.4, b.r * 0.1, b.x, b.y, b.r);
        g.addColorStop(0, "#8d949c"); g.addColorStop(0.45, "#2c3036"); g.addColorStop(1, "#0b0c0f");
        ctx.beginPath(); ctx.fillStyle = g; ctx.arc(b.x, b.y, b.r, 0, 6.283); ctx.fill();
      }
      for (let i = flashes.length - 1; i >= 0; i--) {
        const f = flashes[i]; f.t += dt;
        const k = f.t / 0.16;
        if (k >= 1) { flashes.splice(i, 1); continue; }
        const r = f.r * (0.5 + k);
        const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
        g.addColorStop(0, `rgba(255, 250, 225, ${1 - k})`); g.addColorStop(0.35, `rgba(255, 190, 90, ${(1 - k) * 0.8})`); g.addColorStop(1, "rgba(255, 120, 30, 0)");
        ctx.beginPath(); ctx.fillStyle = g; ctx.arc(f.x, f.y, r, 0, 6.283); ctx.fill();
      }
      for (let i = puffs.length - 1; i >= 0; i--) {
        const p = puffs[i]; p.t += dt;
        const k = p.t / p.life;
        if (k >= 1) { puffs.splice(i, 1); continue; }
        p.vx *= 0.94; p.vy = p.vy * 0.94 - 22 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        const r = p.r + p.grow * k;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        g.addColorStop(0, `rgba(235, 228, 215, ${0.42 * (1 - k)})`); g.addColorStop(1, "rgba(235, 228, 215, 0)");
        ctx.beginPath(); ctx.fillStyle = g; ctx.arc(p.x, p.y, r, 0, 6.283); ctx.fill();
      }
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i]; s.t += dt;
        const k = s.t / s.life;
        if (k >= 1) { sparks.splice(i, 1); continue; }
        s.vy += 500 * dt; s.x += s.vx * dt; s.y += s.vy * dt;
        ctx.beginPath(); ctx.fillStyle = `rgba(${s.c}, ${1 - k})`; ctx.arc(s.x, s.y, 1.8 * (1 - k * 0.5), 0, 6.283); ctx.fill();
      }
      if (balls.length || puffs.length || sparks.length || flashes.length) requestAnimationFrame(loop);
      else { running = false; ctx.clearRect(0, 0, W, H); }
    };

    launchers.forEach(b => {
      b.addEventListener("click", () => fire(b));
      b.addEventListener("animationend", () => b.classList.remove("fire"));
    });
    // They also fire by themselves, one after another, while the row is on screen.
    let timer = null, order = [], inView = false;
    const next = () => {
      if (!inView || document.hidden) return;
      if (!order.length) order = launchers.map((_, i) => i).sort(() => Math.random() - 0.5);
      fire(launchers[order.pop()]);
      timer = setTimeout(next, rand(900, 1700));
    };
    new IntersectionObserver(([e]) => {
      inView = e.isIntersecting;
      clearTimeout(timer);
      if (inView) timer = setTimeout(next, 700);
    }, { threshold: 0.6 }).observe(document.querySelector(".launchers ul"));
  }

  // ------------------------------------------------------------ posters
  const posters = [...document.querySelectorAll(".poster[data-fx]")];
  if (posters.length && !reduced) {
    const live = new Set();
    const setups = posters.map(el => {
      const img = el.querySelector("img");
      const art = document.createElement("div");
      art.className = "poster-art";
      const cv = document.createElement("canvas");
      cv.className = "poster-fx";
      el.insertBefore(art, img);
      art.append(img, cv);
      const o = { el, img, cv, ctx: cv.getContext("2d"), kind: el.dataset.fx, w: 0, h: 0, parts: [], t: rand(0, 20) };
      // a point given as a fraction of the painting -> canvas px (the picture is fitted "cover")
      o.at = (fx, fy) => {
        const iw = img.naturalWidth || 2, ih = img.naturalHeight || 3;
        const s = Math.max(o.w / iw, o.h / ih);
        return [(o.w - iw * s) / 2 + fx * iw * s, (o.h - ih * s) / 2 + fy * ih * s];
      };
      o.size = () => {
        const d = Math.min(devicePixelRatio || 1, 1.5);
        o.w = cv.clientWidth; o.h = cv.clientHeight;
        cv.width = o.w * d; cv.height = o.h * d;
        o.ctx.setTransform(d, 0, 0, d, 0, 0);
        seed(o);
      };
      return o;
    });

    const seed = o => {
      const n = { motes: 34, beam: 46, paper: 16, seeds: 30 }[o.kind];
      o.parts = Array.from({ length: n }, () => ({ x: Math.random(), y: Math.random(), a: Math.random() * 6.28, s: rand(0.5, 1.5), k: Math.random() }));
      o.stars = Array.from({ length: 26 }, () => ({ x: Math.random(), y: Math.random() * 0.7, a: Math.random() * 6.28, s: rand(0.6, 1.6) }));
    };

    const glow = (c, x, y, r, col, a) => {
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${col}, ${a})`); g.addColorStop(1, `rgba(${col}, 0)`);
      c.beginPath(); c.fillStyle = g; c.arc(x, y, r, 0, 6.283); c.fill();
    };

    const draw = (o, dt) => {
      const c = o.ctx, w = o.w, h = o.h;
      o.t += dt;
      c.clearRect(0, 0, w, h);
      if (o.kind === "motes") {            // golden dust in the evening light
        for (const p of o.parts) {
          p.a += dt * p.s; p.x += dt * 0.02 * p.s + Math.sin(p.a) * 0.0006; p.y -= dt * 0.022 * p.s;
          if (p.y < -0.03) { p.y = 1.03; p.x = Math.random(); } if (p.x > 1.03) p.x = -0.03;
          glow(c, p.x * w, p.y * h, 2 + p.s * 2.2, "255, 214, 140", 0.35 + 0.35 * Math.sin(p.a * 1.7));
        }
      } else if (o.kind === "beam") {      // the lamp breathes, a second beam sweeps, rain falls
        const [lx, ly] = o.at(0.19, 0.105), [mx, my] = o.at(0.615, 0.52);
        glow(c, lx, ly, w * (0.2 + 0.04 * Math.sin(o.t * 2.1)), "255, 214, 140", 0.55);
        const ang = (o.t * 0.7) % 6.283, len = h * 1.3, half = 0.11;
        const g = c.createLinearGradient(lx, ly, lx + Math.cos(ang) * len, ly + Math.sin(ang) * len);
        g.addColorStop(0, "rgba(255, 224, 160, 0.34)"); g.addColorStop(1, "rgba(255, 224, 160, 0)");
        c.beginPath(); c.moveTo(lx, ly);
        c.lineTo(lx + Math.cos(ang - half) * len, ly + Math.sin(ang - half) * len);
        c.lineTo(lx + Math.cos(ang + half) * len, ly + Math.sin(ang + half) * len);
        c.closePath(); c.fillStyle = g; c.fill();
        glow(c, mx, my, w * (0.07 + 0.03 * Math.sin(o.t * 3.3)), "255, 236, 190", 0.75);
        c.strokeStyle = "rgba(200, 220, 255, 0.22)"; c.lineWidth = 1;
        for (const p of o.parts) {
          p.y += dt * (0.9 + p.s * 0.5); p.x -= dt * 0.22;
          if (p.y > 1.05) { p.y = -0.05; p.x = Math.random() * 1.3; }
          c.beginPath(); c.moveTo(p.x * w, p.y * h); c.lineTo(p.x * w - 5, p.y * h + 18); c.stroke();
        }
      } else if (o.kind === "paper") {     // the sun glows, scraps of paper tumble past
        const [sx, sy] = o.at(0.59, 0.555);
        glow(c, sx, sy, w * (0.26 + 0.03 * Math.sin(o.t * 1.3)), "255, 200, 120", 0.4);
        for (const p of o.parts) {
          p.a += dt * (1.2 + p.s); p.x += dt * (0.05 + 0.04 * p.s); p.y += Math.sin(p.a * 0.6) * 0.0012 + dt * 0.012;
          if (p.x > 1.08 || p.y > 1.05) { p.x = -0.08; p.y = Math.random() * 0.8; }
          const sz = 5 + p.s * 5;
          c.save(); c.translate(p.x * w, p.y * h); c.rotate(p.a * 0.7); c.scale(1, Math.cos(p.a * 1.9));
          c.fillStyle = `rgba(255, ${238 + Math.round(p.k * 14)}, ${205 + Math.round(p.k * 40)}, 0.85)`;
          c.beginPath(); c.moveTo(-sz, -sz * 0.6); c.lineTo(sz, -sz * 0.35); c.lineTo(sz * 0.7, sz * 0.6); c.lineTo(-sz * 0.8, sz * 0.4); c.closePath(); c.fill();
          c.restore();
        }
      } else if (o.kind === "seeds") {     // stars twinkle, glowing seeds drift up from the garden
        for (const s of o.stars) { s.a += dt * s.s * 2; glow(c, s.x * w, s.y * h, 1.6 + s.s, "255, 255, 255", 0.25 + 0.45 * Math.max(0, Math.sin(s.a))); }
        const cols = ["120, 255, 225", "255, 214, 110", "255, 150, 220", "150, 190, 255"];
        o.parts.forEach((p, i) => {
          p.a += dt * p.s; p.y -= dt * 0.035 * p.s; p.x += Math.sin(p.a) * 0.0009;
          if (p.y < 0.05) { p.y = rand(0.3, 0.72); p.x = rand(0.12, 0.88); }
          const fade = Math.min(1, (p.y - 0.05) * 6) * Math.min(1, (0.75 - p.y) * 6);
          glow(c, p.x * w, p.y * h, 3 + p.s * 3.5, cols[i % 4], Math.max(0, fade) * (0.55 + 0.3 * Math.sin(p.a * 2.3)));
        });
      }
    };

    let last = 0, going = false;
    const tick = now => {
      const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
      live.forEach(o => draw(o, dt));
      if (live.size) requestAnimationFrame(tick); else going = false;
    };
    const io = new IntersectionObserver(es => es.forEach(e => {
      const o = setups.find(s => s.el === e.target);
      if (e.isIntersecting) { if (!o.w) o.size(); live.add(o); } else live.delete(o);
      if (live.size && !going) { going = true; last = 0; requestAnimationFrame(tick); }
    }), { rootMargin: "80px" });
    setups.forEach(o => { io.observe(o.el); o.img.addEventListener("load", o.size); });
    addEventListener("resize", () => setups.forEach(o => o.w && o.size()));

    // posters lean toward the pointer, like a card held in the hand
    if (matchMedia("(hover: hover)").matches) {
      posters.forEach(el => {
        el.addEventListener("pointerenter", () => { el.style.transition = "transform .15s ease-out, border-color .35s"; });
        el.addEventListener("pointermove", e => {
          const r = el.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
          el.style.transform = `perspective(900px) rotateY(${(px * 12).toFixed(2)}deg) rotateX(${(-py * 9).toFixed(2)}deg) translateY(-6px)`;
        });
        el.addEventListener("pointerleave", () => { el.style.transition = "transform .5s ease, border-color .35s"; el.style.transform = ""; });
      });
    }
  }

  // ------------------------------------------------------------ stats count up
  const stats = document.querySelector(".stats");
  if (stats && !reduced) {
    new IntersectionObserver(([e], io) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      stats.querySelectorAll("dt").forEach(dt => {
        const end = parseInt(dt.textContent, 10);
        if (!end) return;
        const t0 = performance.now();
        const step = now => {
          const k = Math.min(1, (now - t0) / 1300);
          dt.textContent = Math.round(end * (1 - Math.pow(1 - k, 3)));
          if (k < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      });
    }, { threshold: 0.6 }).observe(stats);
  }
})();
