// amazedsaints.com, the playful layer: launchers that really fire (and knock
// the world cards about), living concept posters, and counting stats.
(() => {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const soundOn = () => document.querySelector(".sound")?.getAttribute("aria-pressed") === "true";
  const rand = (a, b) => a + Math.random() * (b - a);

  // ------------------------------------------------------------ cannons
  const fx = document.querySelector(".fx");
  const launchers = [...document.querySelectorAll(".launchers .launcher")];
  const reelCannon = document.querySelector(".reel-cannon");
  const phones = [...document.querySelectorAll(".phone")];
  const scoreEl = document.querySelector(".score");
  const studioCannon = document.querySelector(".studio-cannon");
  const studioName = document.querySelector(".studio-name");
  let letters = [];
  if (studioName && !reduced) {         // each letter of the studio name becomes a target
    const text = studioName.textContent;
    studioName.textContent = "";
    // each letter: a wrapper that jumps, a dark copy underneath for the solid
    // edge and shadow (cheaper than a filter over the whole name), and the
    // face that takes the paint. On phones the name breaks after "Amazed".
    letters = [...text].map((ch, i) => {
      const w = document.createElement("span"); w.className = "lw"; w.setAttribute("aria-hidden", "true");
      const sh = document.createElement("span"); sh.className = "ls"; sh.textContent = ch;
      const sp = document.createElement("span"); sp.className = "letter"; sp.textContent = ch;
      w.append(sh, sp); studioName.appendChild(w);
      if (i === 5) { const br = document.createElement("br"); br.className = "name-break"; studioName.appendChild(br); }
      return sp;
    });
  }
  if (fx && (launchers.length || reelCannon || studioCannon) && !reduced) {
    const ctx = fx.getContext("2d");
    let W = 0, H = 0, dpr = 1, running = false, last = 0;
    const balls = [], puffs = [], sparks = [], flashes = [], coins = [], pops = [], drops = [], rings = [];
    let score = 0;
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

    // Paint on a letter: layers of radial gradients drawn through the letter's
    // own shape (background-clip: text), so the splash only covers the glyph.
    // A blob where the ball struck, a crown of drops around it, and a drip or
    // two that runs down and stops. The newest splashes sit on top; a letter
    // keeps its last four.
    const PAINT = ["#FFB547", "#FF5E7E", "#B45CFF", "#3FB8FF", "#2EE6A8"];
    const BASE = "linear-gradient(180deg, #fffaf0 0%, #f6dfa6 48%, #e0a64a 76%, #b97a2a 100%)";
    const paintLayers = l => {
      const all = (l._splats || []).flatMap(sp => sp.layers);
      l.style.backgroundImage = [...all.map(x => x.img), BASE].join(", ");
      l.style.backgroundPosition = [...all.map(x => `${x.x.toFixed(3)}em ${x.y.toFixed(3)}em`), "0 0"].join(", ");
      l.style.backgroundSize = [...all.map(x => `${x.w.toFixed(3)}em ${x.h.toFixed(3)}em`), "100% 100%"].join(", ");
    };
    // On a computer, if frames slow down while paint is flying (measured in
    // the loop below), the name falls back to a plain change of colour for
    // the rest of the visit. Phones always get the full splash.
    const canLite = matchMedia("(hover: hover) and (pointer: fine)").matches;
    let lite = false, slowT = 0, slowN = 0;
    const splat = (l, col, px, py) => {
      if (lite) {
        const lr = l.getBoundingClientRect(), lf = parseFloat(getComputedStyle(l).fontSize) || 60;
        const lw = lr.width / lf, lh = lr.height / lf;
        l._splats = [{ layers: [
          { img: "linear-gradient(180deg, rgba(255, 255, 255, .6), rgba(255, 255, 255, 0) 55%)", x: 0, y: 0, w: lw, h: lh },
          { img: `linear-gradient(${col}, ${col})`, x: 0, y: 0, w: lw, h: lh },
        ] }];
        paintLayers(l);
        return;
      }
      const r = l.getBoundingClientRect(), fs = parseFloat(getComputedStyle(l).fontSize) || 60;
      const w = r.width / fs, h = r.height / fs;
      const cx = Math.min(w * 0.85, Math.max(w * 0.15, (px - r.left) / fs)), cy = Math.min(h * 0.8, Math.max(h * 0.2, (py - r.top) / fs));
      const dot = (x, y, rad) => ({ img: `radial-gradient(circle closest-side, ${col} 0 86%, transparent 100%)`, x: x - rad, y: y - rad, w: rad * 2, h: rad * 2 });
      const big = rand(0.26, 0.36), layers = [];
      // the crown of drops first, so the blob sits over them
      for (let i = 0; i < 7; i++) { const a = rand(0, 6.283), d = big * rand(1.05, 1.9); layers.push(dot(cx + Math.cos(a) * d, cy + Math.sin(a) * d, rand(0.025, 0.07))); }
      layers.push(dot(cx + rand(-0.05, 0.05), cy + rand(-0.05, 0.05), big * 0.72));
      layers.push(dot(cx, cy, big));
      // drips: a narrow run of paint growing down from the blob, with a bead at its end
      const drips = [];
      for (let i = 0, n = Math.random() < 0.6 ? 2 : 1; i < n; i++) {
        const dx = cx + rand(-big * 0.6, big * 0.6), wd = rand(0.05, 0.085);
        const run = { img: `linear-gradient(${col}, ${col})`, x: dx - wd / 2, y: cy, w: wd, h: 0 };
        const bead = dot(dx, cy, wd * 0.75);
        layers.unshift(run, bead);
        drips.push({ run, bead, len: rand(0.25, 0.6), wd });
      }
      l._splats = [{ layers }, ...(l._splats || [])].slice(0, 4);
      paintLayers(l);
      if (drips.length) {
        const t0 = performance.now();
        const grow = now => {
          const k = Math.min(1, (now - t0) / 1400), e = 1 - Math.pow(1 - k, 2.2);
          drips.forEach(d => { d.run.h = d.len * e; d.bead.y = cy + d.len * e - d.wd * 0.75; });
          paintLayers(l);
          if (k < 1) requestAnimationFrame(grow);
        };
        requestAnimationFrame(grow);
      }
    };

    // fire(btn): along the barrel. fire(btn, target): lobbed to land on the target.
    const fire = (btn, target) => {
      const r = btn.getBoundingClientRect();
      if (r.bottom < 0 || r.top > H) return;
      const [mx, my] = btn.dataset.m.split(",").map(Number);
      let [dx, dy] = btn.dataset.d.split(",").map(Number);
      let x = r.left + r.width * mx / 100, y = r.top + r.height * my / 100;
      if (target) {
        const t = target.getBoundingClientRect();
        const tx = t.left + t.width * rand(0.3, 0.7), ty = t.top + t.height * rand(0.45, 0.75);
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2, g = 900;
        const solve = (sx, sy) => {
          const T = Math.min(0.8, Math.max(0.45, Math.hypot(tx - sx, ty - sy) / 900));
          return [T, (tx - sx) / T, (ty - sy) / T - 0.5 * g * T];
        };
        // Aim the launcher: its picture points up and to the right, so it
        // is flipped for a target on the left, then tilted toward the shot.
        let [T, vx, vy] = solve(cx, cy);
        const flip = vx < 0;
        const bx = flip ? -dx : dx;
        let turn = Math.atan2(vy, vx) - Math.atan2(dy, bx);
        turn = Math.max(-0.7, Math.min(0.7, Math.atan2(Math.sin(turn), Math.cos(turn))));
        const img = btn.querySelector("img");
        if (img) img.style.transform = `rotate(${(turn * 57.2958).toFixed(1)}deg) scaleX(${flip ? -1 : 1})`;
        // the muzzle, after the same flip and tilt
        const ox = (mx - 50) / 100 * r.width * (flip ? -1 : 1), oy = (my - 50) / 100 * r.height;
        x = cx + ox * Math.cos(turn) - oy * Math.sin(turn);
        y = cy + ox * Math.sin(turn) + oy * Math.cos(turn);
        [T, vx, vy] = solve(x, y);
        balls.push({ x, y, vx, vy, g, r: Math.max(7, r.width * 0.1), life: 0, trail: [], only: target, T });
        const n = Math.hypot(vx, vy); dx = vx / n; dy = vy / n;
      } else {
        // on a narrow screen the shot is lobbed steeper, so it reaches the
        // world cards above before it runs out of screen
        const narrow = W < 700;
        if (narrow) { dx *= 0.42; const n = Math.hypot(dx, dy); dx /= n; dy /= n; }
        const speed = narrow ? 640 : Math.min(1050, Math.max(620, W * 0.75));
        balls.push({ x, y, vx: dx * speed, vy: dy * speed, g: speed * 0.62, r: Math.max(6, r.width * 0.1), life: 0, trail: [] });
      }
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
      if (card.classList.contains("letter")) {      // a letter of the studio name: paint splashes on it
        card.parentNode.style.setProperty("--tilt", `${rand(-14, 14)}deg`);
        // each hit is a new colour, splashed where the ball struck; the paint stays
        const cols = PAINT.filter(c2 => c2 !== card.dataset.col);
        const col = cols[Math.floor(Math.random() * cols.length)];
        card.dataset.col = col;
        splat(card, col, b.x, b.y);
        const lw = card.parentNode;
        lw.classList.remove("hit"); void lw.offsetWidth; lw.classList.add("hit");
        studioName.classList.remove("shake"); void studioName.offsetWidth; studioName.classList.add("shake");
        const rgb = col.match(/\w\w/g).map(h => parseInt(h, 16)).join(", ");
        // paint drops fly off the letter and fall, a ring of colour spreads
        for (let i = 0; i < (lite ? 8 : 22); i++) { const a = rand(-3.0, -0.15), s = rand(120, 520); drops.push({ x: b.x, y: b.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, life: rand(0.7, 1.3), r: rand(2.2, 5.5), c: rgb }); }
        for (let i = 0; i < 10; i++) { const a = rand(0, 6.283), s = rand(80, 300); sparks.push({ x: b.x, y: b.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 90, t: 0, life: rand(0.3, 0.6), c: "255, 250, 235" }); }
        rings.push({ x: b.x, y: b.y, t: 0, r: card.getBoundingClientRect().height * 1.3, c: rgb });
        flashes.push({ x: b.x, y: b.y, t: 0, r: b.r * 4 });
        boom(0.22, 1.8);
        return;
      }
      if (card.classList.contains("phone")) {       // a game picture: it shakes and pays out
        card.style.setProperty("--px", `${(b.vx > 0 ? 1 : -1) * rand(5, 9)}px`);
        for (let i = 0; i < 12; i++) {
          const a = rand(-2.6, -0.5), s = rand(180, 460);
          coins.push({ x: b.x, y: b.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, life: rand(0.9, 1.4), r: rand(4, 6.5), spin: rand(0, 6.28) });
        }
        const gain = 100;
        score += gain;
        pops.push({ x: b.x, y: b.y - 10, t: 0, text: `+${gain}` });
        if (scoreEl) scoreEl.textContent = score.toLocaleString("en-US");
      }
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
      const raw = (now - (last || now)) / 1000;
      const dt = Math.min(0.033, raw); last = now;
      if (canLite && !lite && drops.length && raw > 0) {      // watch the frame rate while paint flies
        slowT += raw; slowN++;
        if (slowN >= 45) { if (slowT / slowN > 0.04) lite = true; slowT = 0; slowN = 0; }
      }
      ctx.clearRect(0, 0, W, H);
      const cards = balls.length ? [...document.querySelectorAll(".chapter")].map(c => [c, c.getBoundingClientRect()]).filter(([, r]) => r.bottom > 0 && r.top < H && r.right > 0 && r.left < W) : [];
      for (let i = balls.length - 1; i >= 0; i--) {
        const b = balls[i];
        b.life += dt; b.vy += b.g * dt; b.x += b.vx * dt; b.y += b.vy * dt;
        b.trail.push([b.x, b.y]); if (b.trail.length > 10) b.trail.shift();
        let gone = b.y > H + 60 || b.x > W + 60 || b.x < -60;
        if (!gone && b.only) {               // an aimed shot flies on to its mark
          if (b.life >= b.T) { hit(b.only, b); gone = true; }
        } else if (!gone && b.life > 0.06) {  // a free shot bursts on the first world card it touches
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
      for (let i = drops.length - 1; i >= 0; i--) {   // paint drops: stretched along their flight, they fall and fade
        const q = drops[i]; q.t += dt;
        const k = q.t / q.life;
        if (k >= 1) { drops.splice(i, 1); continue; }
        q.vy += 980 * dt; q.vx *= 0.99; q.x += q.vx * dt; q.y += q.vy * dt;
        const sp = Math.hypot(q.vx, q.vy), st = Math.min(2.6, 1 + sp / 500);
        ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(Math.atan2(q.vy, q.vx));
        ctx.beginPath(); ctx.fillStyle = `rgba(${q.c}, ${k > 0.65 ? (1 - k) / 0.35 : 1})`;
        ctx.ellipse(0, 0, q.r * st, q.r / Math.sqrt(st), 0, 0, 6.283); ctx.fill();
        ctx.beginPath(); ctx.fillStyle = `rgba(255, 255, 255, ${0.45 * (1 - k)})`; ctx.arc(-q.r * 0.25 * st, -q.r * 0.3, q.r * 0.3, 0, 6.283); ctx.fill();
        ctx.restore();
      }
      for (let i = rings.length - 1; i >= 0; i--) {   // a ring of colour spreading from a splash
        const q = rings[i]; q.t += dt;
        const k = q.t / 0.55;
        if (k >= 1) { rings.splice(i, 1); continue; }
        ctx.beginPath(); ctx.lineWidth = 5 * (1 - k) + 1; ctx.strokeStyle = `rgba(${q.c}, ${0.85 * (1 - k)})`;
        ctx.arc(q.x, q.y, q.r * (0.2 + 0.8 * (1 - Math.pow(1 - k, 3))), 0, 6.283); ctx.stroke();
      }
      for (let i = coins.length - 1; i >= 0; i--) {
        const q = coins[i]; q.t += dt;
        const k = q.t / q.life;
        if (k >= 1) { coins.splice(i, 1); continue; }
        q.vy += 900 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.spin += dt * 9;
        const sx = Math.abs(Math.cos(q.spin)) * 0.75 + 0.25, al = k > 0.7 ? (1 - k) / 0.3 : 1;
        ctx.save(); ctx.translate(q.x, q.y); ctx.scale(sx, 1);
        ctx.beginPath(); ctx.fillStyle = `rgba(255, 196, 46, ${al})`; ctx.arc(0, 0, q.r, 0, 6.283); ctx.fill();
        ctx.beginPath(); ctx.fillStyle = `rgba(255, 236, 150, ${al})`; ctx.arc(-q.r * 0.2, -q.r * 0.25, q.r * 0.55, 0, 6.283); ctx.fill();
        ctx.lineWidth = 1; ctx.strokeStyle = `rgba(160, 100, 10, ${al * 0.8})`; ctx.beginPath(); ctx.arc(0, 0, q.r, 0, 6.283); ctx.stroke();
        ctx.restore();
      }
      for (let i = pops.length - 1; i >= 0; i--) {
        const q = pops[i]; q.t += dt;
        const k = q.t / 1.1;
        if (k >= 1) { pops.splice(i, 1); continue; }
        ctx.font = `600 ${Math.round(22 + 8 * Math.min(1, k * 4))}px Inter, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.lineWidth = 4; ctx.strokeStyle = `rgba(20, 12, 4, ${(1 - k) * 0.8})`; ctx.strokeText(q.text, q.x, q.y - k * 60);
        ctx.fillStyle = `rgba(255, 214, 110, ${1 - k})`; ctx.fillText(q.text, q.x, q.y - k * 60);
      }
      if (balls.length || puffs.length || sparks.length || flashes.length || coins.length || pops.length || drops.length || rings.length) requestAnimationFrame(loop);
      else { running = false; ctx.clearRect(0, 0, W, H); }
    };

    launchers.forEach(b => {
      b.addEventListener("click", () => fire(b));
      b.addEventListener("animationend", () => b.classList.remove("fire"));
    });

    // The studio name: the ice cannon picks off its letters; tap a letter to aim.
    if (studioCannon && letters.length) {
      const shootName = l => fire(studioCannon, l || letters[Math.floor(Math.random() * letters.length)]);
      letters.forEach(l => l.addEventListener("click", () => shootName(l)));
      studioCannon.addEventListener("click", () => shootName());
      studioCannon.addEventListener("animationend", () => studioCannon.classList.remove("fire"));
      let st = null, sOn = false;
      const sAuto = () => { if (!sOn || document.hidden) return; shootName(); st = setTimeout(sAuto, rand(1300, 2400)); };
      new IntersectionObserver(([e]) => { sOn = e.isIntersecting; clearTimeout(st); if (sOn) st = setTimeout(sAuto, 900); }, { threshold: 0.8 }).observe(studioCannon);
    }

    // The game pictures: tap one and the cannon under them fires at it.
    if (reelCannon && phones.length) {
      const visible = () => phones.filter(ph => { const r = ph.getBoundingClientRect(); return r.right > 20 && r.left < W - 20 && r.bottom > 0 && r.top < H; });
      const shoot = ph => fire(reelCannon, ph || visible()[Math.floor(Math.random() * visible().length)] || phones[0]);
      phones.forEach(ph => ph.addEventListener("click", () => shoot(ph)));
      reelCannon.addEventListener("click", () => shoot());
      reelCannon.addEventListener("animationend", () => reelCannon.classList.remove("fire"));
      let rt = null, on = false;
      const auto = () => { if (!on || document.hidden) return; shoot(); rt = setTimeout(auto, rand(2200, 3600)); };
      new IntersectionObserver(([e]) => { on = e.isIntersecting; clearTimeout(rt); if (on) rt = setTimeout(auto, 1200); }, { threshold: 0.8 }).observe(reelCannon);
    }
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
  const posters = [...document.querySelectorAll(".poster[data-fx], .chapter[data-fx], .studio-bg[data-fx]")];
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
      const o = { el, img, cv, ctx: cv.getContext("2d"), kind: el.dataset.fx, w: 0, h: 0, parts: [], t: rand(0, 20), bits: [], taps: [], planes: [], blooms: [], flash: 0, ang: rand(0, 6.283), aim: null };
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
      const n = { motes: 34, beam: 46, paper: 16, seeds: 30, snow: 70, toy: 22, bricks: 10, leaves: 22, sugar: 30, street: 16, crystal: 26, embers: 34, fireworks: 0 }[o.kind];
      o.parts = Array.from({ length: n }, () => ({ x: Math.random(), y: Math.random(), a: Math.random() * 6.28, s: rand(0.5, 1.5), k: Math.random() }));
      o.stars = Array.from({ length: 26 }, () => ({ x: Math.random(), y: Math.random() * 0.7, a: Math.random() * 6.28, s: rand(0.6, 1.6) }));
    };

    // A soft glow, drawn from a small picture made once per colour (building
    // a gradient for every particle on every frame was the slow part).
    const sprites = new Map();
    const sprite = col => {
      let s = sprites.get(col);
      if (!s) {
        s = document.createElement("canvas"); s.width = s.height = 64;
        const x = s.getContext("2d"), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
        g.addColorStop(0, `rgba(${col}, 1)`); g.addColorStop(1, `rgba(${col}, 0)`);
        x.fillStyle = g; x.fillRect(0, 0, 64, 64);
        sprites.set(col, s);
      }
      return s;
    };
    const glow = (c, x, y, r, col, a) => {
      if (!(a > 0.004) || !(r > 0)) return;
      c.globalAlpha = Math.min(1, a);
      c.drawImage(sprite(col), x - r, y - r, r * 2, r * 2);
      c.globalAlpha = 1;
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
        if (o.aim && o.aim.t < 2.6) {      // pointed at the tap (or the mouse), then it carries on turning
          o.aim.t += dt;
          const want = Math.atan2(o.aim.y - ly, o.aim.x - lx);
          o.ang += Math.atan2(Math.sin(want - o.ang), Math.cos(want - o.ang)) * Math.min(1, dt * 7);
        } else o.ang += dt * 0.7;
        if (o.flash > 0) {                 // lightning: the whole sky flashes
          o.flash = Math.max(0, o.flash - dt * 2.2);
          c.fillStyle = `rgba(205, 220, 255, ${(o.flash * o.flash * 0.55).toFixed(3)})`; c.fillRect(0, 0, w, h);
        }
        const ang = o.ang, len = h * 1.3, half = o.aim && o.aim.t < 2.6 ? 0.14 : 0.11;
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
      } else if (o.kind === "snow") {      // snow drifts through the ice hall, the lantern glows and sways
        const [lx, ly] = o.at(0.502 + Math.sin(o.t * 0.9) * 0.004, 0.6);
        glow(c, lx, ly, h * (0.2 + 0.03 * Math.sin(o.t * 2.3)), "255, 200, 120", 0.5);
        glow(c, lx, ly, h * 0.06, "255, 236, 190", 0.8);
        for (const p of o.parts) {
          p.a += dt * p.s; p.y += dt * (0.03 + 0.035 * p.s); p.x += Math.sin(p.a) * 0.0007 + dt * 0.006;
          if (p.y > 1.03) { p.y = -0.03; p.x = Math.random(); }
          glow(c, p.x * w, p.y * h, 1.5 + p.s * 2.6, "235, 242, 255", 0.35 + 0.3 * p.k);
        }
      } else if (o.kind === "toy") {       // bubbles float up, confetti tumbles down
        const cols = ["255, 90, 120", "255, 200, 60", "80, 200, 255", "140, 230, 120", "190, 120, 255"];
        o.parts.forEach((p, i) => {
          p.a += dt * (1 + p.s);
          if (i % 2) {
            p.y -= dt * 0.05 * p.s; p.x += Math.sin(p.a) * 0.0012;
            if (p.y < -0.05) { p.y = 1.05; p.x = Math.random(); }
            const r = 3 + p.s * 4;
            c.beginPath(); c.strokeStyle = "rgba(255, 255, 255, 0.55)"; c.lineWidth = 1.2; c.arc(p.x * w, p.y * h, r, 0, 6.283); c.stroke();
            glow(c, p.x * w - r * 0.3, p.y * h - r * 0.3, r * 0.6, "255, 255, 255", 0.6);
          } else {
            p.y += dt * 0.06 * p.s; p.x += Math.sin(p.a * 0.7) * 0.0015;
            if (p.y > 1.05) { p.y = -0.05; p.x = Math.random(); }
            c.save(); c.translate(p.x * w, p.y * h); c.rotate(p.a); c.scale(1, Math.cos(p.a * 2.1));
            c.fillStyle = `rgba(${cols[i % 5]}, 0.9)`; c.fillRect(-3.5, -2, 7, 4); c.restore();
          }
        });
      } else if (o.kind === "bricks") {    // the sun's rays turn, the train puffs, the water glints
        const [sx, sy] = o.at(0.105, 0.055), [tx, ty] = o.at(0.7, 0.6);
        c.save(); c.translate(sx, sy); c.rotate(o.t * 0.25);
        for (let i = 0; i < 12; i++) {
          c.rotate(6.283 / 12);
          const g = c.createLinearGradient(0, 0, w * 0.34, 0);
          g.addColorStop(0, "rgba(255, 236, 130, 0.5)"); g.addColorStop(1, "rgba(255, 236, 130, 0)");
          c.beginPath(); c.moveTo(0, 0); c.lineTo(w * 0.34, -w * 0.022); c.lineTo(w * 0.34, w * 0.022); c.closePath(); c.fillStyle = g; c.fill();
        }
        c.restore();
        o.parts.forEach((p, i) => {
          if (i < 5) {                     // steam puffs
            p.k += dt * 0.35 * p.s; if (p.k > 1) p.k = 0;
            glow(c, tx - p.k * w * 0.08 + Math.sin(p.a + p.k * 5) * 3, ty - p.k * h * 0.11, 5 + p.k * 16, "255, 255, 255", 0.55 * (1 - p.k));
          } else {                         // glints on the lake
            p.a += dt * 3 * p.s;
            const [gx, gy] = o.at(0.3 + p.x * 0.5, 0.5 + p.y * 0.1);
            glow(c, gx, gy, 2.5, "255, 255, 255", Math.max(0, Math.sin(p.a)) * 0.8);
          }
        });
      } else if (o.kind === "leaves" || o.kind === "street") {   // autumn leaves drift down
        const cols = ["230, 120, 30", "250, 180, 50", "200, 70, 30", "240, 150, 40"];
        o.parts.forEach((p, i) => {
          p.a += dt * (1 + p.s); p.y += dt * 0.055 * p.s; p.x += dt * 0.02 + Math.sin(p.a * 0.8) * 0.0018;
          if (p.y > 1.05 || p.x > 1.08) { p.y = -0.05; p.x = Math.random() * 1.1 - 0.1; }
          if (o.kind === "street" && i % 3 === 0) {              // warm glints in the shop windows
            const [gx, gy] = o.at(0.12 + p.k * 0.8, 0.25 + ((i * 37) % 60) / 100);
            glow(c, gx, gy, 7, "255, 214, 130", Math.max(0, Math.sin(p.a * 0.9)) * 0.55);
            return;
          }
          const sz = 3.5 + p.s * 2.5;
          c.save(); c.translate(p.x * w, p.y * h); c.rotate(p.a); c.scale(1, 0.45 + 0.55 * Math.abs(Math.cos(p.a * 1.3)));
          c.fillStyle = `rgba(${cols[i % 4]}, 0.9)`; c.beginPath(); c.ellipse(0, 0, sz * 1.5, sz * 0.7, 0, 0, 6.283); c.fill(); c.restore();
        });
        if (o.kind === "leaves") for (const s of o.stars) { s.a += dt * s.s; s.y -= dt * 0.012; if (s.y < 0) s.y = 0.7; glow(c, s.x * w, (0.3 + s.y) * h, 2 + s.s, "255, 214, 140", 0.25 + 0.25 * Math.sin(s.a * 2)); }
      } else if (o.kind === "sugar" || o.kind === "crystal") {   // sparkles: sugar pink and gold, or icy white
        const cols = o.kind === "sugar" ? ["255, 255, 255", "255, 190, 220", "255, 230, 150"] : ["255, 255, 255", "170, 220, 255", "200, 170, 255"];
        if (o.kind === "crystal") {                                // soft light moving across the ice
          const x = ((o.t * 0.06) % 1.6 - 0.3) * w;
          const g = c.createLinearGradient(x, 0, x + w * 0.5, h);
          g.addColorStop(0, "rgba(160, 210, 255, 0)"); g.addColorStop(0.5, "rgba(160, 210, 255, 0.2)"); g.addColorStop(1, "rgba(160, 210, 255, 0)");
          c.fillStyle = g; c.fillRect(0, 0, w, h);
        }
        o.parts.forEach((p, i) => {
          p.a += dt * (1.2 + p.s * 1.5);
          const a = Math.max(0, Math.sin(p.a));
          if (a < 0.02 && Math.random() < 0.02) { p.x = Math.random(); p.y = Math.random() * 0.8; }
          const x = p.x * w, y = p.y * h, r = (3 + p.s * 4) * a;
          c.strokeStyle = `rgba(${cols[i % 3]}, ${a})`; c.lineWidth = 1.2;
          c.beginPath(); c.moveTo(x - r, y); c.lineTo(x + r, y); c.moveTo(x, y - r); c.lineTo(x, y + r); c.stroke();
          glow(c, x, y, r * 1.2, cols[i % 3], a * 0.5);
        });
      } else if (o.kind === "embers") {    // sparks rise from the forge
        for (const p of o.parts) {
          p.a += dt * p.s * 2; p.y -= dt * (0.1 + 0.08 * p.s); p.x += Math.sin(p.a) * 0.002 + dt * 0.01;
          if (p.y < -0.03) { p.y = rand(0.5, 1.05); p.x = Math.random(); }
          glow(c, p.x * w, p.y * h, 1.5 + p.s * 1.8, p.k > 0.5 ? "255, 150, 50" : "255, 210, 110", Math.min(1, p.y * 2.2) * (0.6 + 0.4 * Math.sin(p.a * 3)));
        }
      } else if (o.kind === "fireworks") { // stars twinkle, rockets burst over the summit
        for (const s of o.stars) { s.a += dt * s.s * 2; glow(c, s.x * w, s.y * h * 0.8, 1.4 + s.s, "255, 255, 255", 0.2 + 0.5 * Math.max(0, Math.sin(s.a))); }
        o.next = (o.next ?? 0.5) - dt;
        if (o.next <= 0) {
          o.next = rand(0.8, 1.9);
          const cx = rand(0.15, 0.85), cy = rand(0.08, 0.36), col = ["255, 120, 150", "255, 215, 110", "130, 210, 255", "190, 150, 255", "140, 255, 190"][Math.floor(Math.random() * 5)];
          for (let i = 0; i < 26; i++) { const a = (i / 26) * 6.283 + rand(-0.1, 0.1), v = rand(0.07, 0.16); o.parts.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v * (w / h), t: 0, life: rand(0.9, 1.5), col }); }
        }
        for (let i = o.parts.length - 1; i >= 0; i--) {
          const p = o.parts[i]; p.t += dt;
          const k = p.t / p.life;
          if (k >= 1) { o.parts.splice(i, 1); continue; }
          p.vx *= 0.975; p.vy = p.vy * 0.975 + dt * 0.03; p.x += p.vx * dt; p.y += p.vy * dt;
          glow(c, p.x * w, p.y * h, 2.6 * (1 - k * 0.5), p.col, 1 - k);
        }
      }
    };

    // What a tap leaves behind on a poster: a ripple where the finger landed,
    // and each poster's own answer (the lamp's beam swings round to it and
    // lightning flashes; a paper plane is thrown from it; a flower of light
    // blooms there and its seeds float up).
    const drawTaps = (o, dt) => {
      const c = o.ctx, w = o.w, h = o.h;
      const tint = { beam: "255, 226, 160", paper: "255, 240, 214", seeds: "140, 255, 220", motes: "255, 214, 140" }[o.kind] || "255, 255, 255";
      for (let i = o.taps.length - 1; i >= 0; i--) {
        const q = o.taps[i]; q.t += dt;
        const k = q.t / 0.7;
        if (k >= 1) { o.taps.splice(i, 1); continue; }
        c.beginPath(); c.lineWidth = 2.5 * (1 - k) + 0.5; c.strokeStyle = `rgba(${tint}, ${0.9 * (1 - k)})`;
        c.arc(q.x, q.y, 8 + w * 0.32 * (1 - Math.pow(1 - k, 3)), 0, 6.283); c.stroke();
        glow(c, q.x, q.y, 26 * (1 - k) + 6, tint, 0.7 * (1 - k));
      }
      for (let i = o.planes.length - 1; i >= 0; i--) {   // paper planes
        const q = o.planes[i]; q.t += dt;
        const a = q.a0 + Math.sin(q.t * 2.6) * 0.42 - (q.t > 0.9 && q.t < 1.9 ? (q.t - 0.9) * 6.283 : 0) * q.loop;
        q.x += Math.cos(a) * q.v * dt; q.y += Math.sin(a) * q.v * dt;
        q.trail.push([q.x, q.y]); if (q.trail.length > 26) q.trail.shift();
        if (q.x > w + 60 || q.x < -60 || q.y < -60 || q.y > h + 60 || q.t > 6) { o.planes.splice(i, 1); continue; }
        q.trail.forEach(([tx, ty], j) => { if (j % 2) return; c.beginPath(); c.fillStyle = `rgba(255, 236, 200, ${(j / q.trail.length) * 0.55})`; c.arc(tx, ty, 1.4, 0, 6.283); c.fill(); });
        const sz = q.s;
        c.save(); c.translate(q.x, q.y); c.rotate(a);
        c.fillStyle = "rgba(255, 252, 244, 0.97)";
        c.beginPath(); c.moveTo(sz, 0); c.lineTo(-sz * 0.8, -sz * 0.6); c.lineTo(-sz * 0.45, 0); c.closePath(); c.fill();
        c.fillStyle = "rgba(226, 214, 192, 0.97)";
        c.beginPath(); c.moveTo(sz, 0); c.lineTo(-sz * 0.8, sz * 0.42); c.lineTo(-sz * 0.45, 0); c.closePath(); c.fill();
        c.restore();
      }
      for (let i = o.blooms.length - 1; i >= 0; i--) {   // a flower of light opening
        const q = o.blooms[i]; q.t += dt;
        const k = q.t / 1.6;
        if (k >= 1) { o.blooms.splice(i, 1); continue; }
        const open = 1 - Math.pow(1 - Math.min(1, k * 2.2), 3), fade = k > 0.55 ? (1 - k) / 0.45 : 1;
        c.save(); c.translate(q.x, q.y); c.rotate(q.r + k * 0.8);
        for (let p = 0; p < 8; p++) {
          c.rotate(6.283 / 8);
          c.beginPath(); c.fillStyle = `rgba(${q.c}, ${0.5 * fade})`;
          c.ellipse(q.size * 0.55 * open, 0, q.size * 0.5 * open, q.size * 0.2 * open, 0, 0, 6.283); c.fill();
        }
        c.restore();
        glow(c, q.x, q.y, q.size * 0.5 * open + 4, "255, 250, 220", 0.8 * fade);
      }
      for (let i = o.bits.length - 1; i >= 0; i--) {     // scraps and seeds thrown out by a tap
        const q = o.bits[i]; q.t += dt;
        const k = q.t / q.life;
        if (k >= 1) { o.bits.splice(i, 1); continue; }
        q.vx *= Math.pow(0.3, dt); q.vy = q.vy * Math.pow(0.3, dt) + q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.a += dt * 6;
        if (q.kind === "scrap") {
          c.save(); c.translate(q.x, q.y); c.rotate(q.a); c.scale(1, Math.cos(q.a * 1.7));
          c.fillStyle = `rgba(255, 246, 225, ${1 - k})`; c.fillRect(-q.s, -q.s * 0.7, q.s * 2, q.s * 1.4); c.restore();
        } else glow(c, q.x, q.y, q.s, q.c, (1 - k) * (0.7 + 0.3 * Math.sin(q.a)));
      }
    };
    const tapPoster = (o, x, y, sx = 0, sy = 0) => {
      o.taps.push({ x, y, t: 0 });
      o.el.classList.remove("tap"); void o.el.offsetWidth; o.el.classList.add("tap");
      if (o.kind === "beam") {
        o.aim = { x, y, t: 0 }; o.flash = 1;
        for (let i = 0; i < 14; i++) { const a = rand(0, 6.283), v = rand(40, 160); o.bits.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: -10, t: 0, life: rand(0.6, 1.2), s: rand(2, 4), a: rand(0, 6), c: "255, 226, 160" }); }
      } else if (o.kind === "paper") {
        // thrown the way the finger flicked, or up and to the right
        const fl = Math.hypot(sx, sy) > 20 ? Math.atan2(sy, sx) : rand(-0.75, -0.35);
        o.planes.push({ x, y, a0: fl, v: rand(150, 220), s: Math.max(12, o.w * 0.05), t: 0, trail: [], loop: Math.random() < 0.5 ? 1 : 0 });
        for (let i = 0; i < 10; i++) { const a = rand(0, 6.283), v = rand(60, 220); o.bits.push({ kind: "scrap", x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, g: 90, t: 0, life: rand(0.8, 1.4), s: rand(2.5, 5), a: rand(0, 6) }); }
      } else if (o.kind === "seeds") {
        const cols = ["120, 255, 225", "255, 214, 110", "255, 150, 220", "150, 190, 255"];
        o.blooms.push({ x, y, t: 0, r: rand(0, 6), size: o.w * rand(0.18, 0.24), c: cols[Math.floor(Math.random() * 4)] });
        for (let i = 0; i < 26; i++) { const a = rand(0, 6.283), v = rand(60, 200); o.bits.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: -70, t: 0, life: rand(1.2, 2.4), s: rand(2.5, 5), a: rand(0, 6), c: cols[i % 4] }); }
      }
      if (!live.has(o)) { if (!o.w) o.size(); live.add(o); }
      if (!going) { going = true; last = 0; requestAnimationFrame(tick); }
    };

    let last = 0, going = false;
    const tick = now => {
      const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
      live.forEach(o => { draw(o, dt); drawTaps(o, dt); });
      if (live.size) requestAnimationFrame(tick); else going = false;
    };
    const io = new IntersectionObserver(es => es.forEach(e => {
      const o = setups.find(s => s.el === e.target);
      if (e.isIntersecting) { if (!o.w) o.size(); live.add(o); } else live.delete(o);
      if (live.size && !going) { going = true; last = 0; requestAnimationFrame(tick); }
    }), { rootMargin: "80px" });
    setups.forEach(o => { io.observe(o.el); o.img.addEventListener("load", o.size); });
    addEventListener("resize", () => setups.forEach(o => o.w && o.size()));

    // Tap (or click) a concept poster and it answers; a flick throws the
    // paper plane that way; on a computer the lamp's beam follows the mouse.
    // Taps never block scrolling: a swipe that starts on a poster scrolls.
    setups.filter(o => o.el.classList.contains("poster-concept")).forEach(o => {
      let down = null;
      const local = e => { const r = o.cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
      o.el.addEventListener("pointerdown", e => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
      o.el.addEventListener("click", e => {
        const [x, y] = local(e);
        let sx = 0, sy = 0;
        if (down && performance.now() - down.t < 600) { sx = e.clientX - down.x; sy = e.clientY - down.y; }
        tapPoster(o, x, y, sx, sy);
      });
      o.el.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); tapPoster(o, o.w * 0.5, o.h * 0.45); } });
      if (o.kind === "beam" && matchMedia("(hover: hover)").matches) {
        o.el.addEventListener("pointermove", e => { const [x, y] = local(e); o.aim = { x, y, t: 0 }; });
      }
    });

    // posters lean toward the pointer, like a card held in the hand
    if (matchMedia("(hover: hover)").matches) {
      posters.filter(el => el.classList.contains("poster")).forEach(el => {
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
