/* Manual folding wave. No timers or automatic slide advance. */
(() => {
  const team = document.querySelector('#about .team');
  if (!team) return;
  const cards = [...team.querySelectorAll('.member')];
  if (cards.length < 2) return;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  team.classList.add('fold-team');
  team.tabIndex = 0;
  team.setAttribute('role', 'group');
  team.setAttribute('aria-label', 'SAPFIR');
  team.append(canvas);
  const nav = document.createElement('div');
  nav.className = 'fold-nav';
  team.after(nav);
  let current = 0, next = 1, progress = 0, direction = 1;
  let pointer = null, moving = false, animating = false, raf = 0, suppressUntil = 0;
  let width = 0, height = 0;
  const photos = cards.map(card => card.querySelector('img'));
  const textures = new Map();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const dots = cards.map((card, i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-label', card.querySelector('h3').textContent.trim());
    button.addEventListener('click', () => go(i));
    nav.append(button);
    // Start loading all four pictures so the first swipe is ready.
    photos[i].loading = 'eager';
    photos[i].addEventListener('load', () => { textures.delete(i); if (moving || animating) paint(); });
    return button;
  });
  function select(i) {
    current = i;
    cards.forEach((card, j) => {
      card.classList.toggle('is-current', j === i);
      card.setAttribute('aria-hidden', String(j !== i));
      card.querySelector('button').tabIndex = j === i ? 0 : -1;
      card.querySelector('.member-caption').style.opacity = '';
    });
    dots.forEach((dot, j) => dot.setAttribute('aria-current', String(j === i)));
  }
  function size() {
    width = team.clientWidth; height = team.clientHeight;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    textures.clear();
    if (moving || animating) paint();
  }
  function texture(i) {
    if (textures.has(i)) return textures.get(i);
    const img = photos[i];
    if (!img.complete || !img.naturalWidth) return null;
    const out = document.createElement('canvas');
    out.width = canvas.width; out.height = canvas.height;
    const c = out.getContext('2d');
    const scale = Math.max(out.width / img.naturalWidth, out.height / img.naturalHeight);
    const w = img.naturalWidth * scale, h = img.naturalHeight * scale;
    c.drawImage(img, (out.width - w) / 2, (out.height - h) * .32, w, h);
    textures.set(i, out); return out;
  }
  function paint() {
    const a = texture(current), b = texture(next);
    // If an image is still loading, keep the real photograph visible.
    if (!a || !b) { team.classList.remove('is-folding'); return; }
    team.classList.add('is-folding');
    ctx.clearRect(0, 0, width, height);
    const p = progress;
    const band = width * .24;
    const crease = direction > 0 ? width + band - p * (width + 2 * band) : -band + p * (width + 2 * band);
    for (let x = 0; x < width; x += 1) {
      const distance = (x - crease) * direction;
      const wave = Math.exp(-Math.pow(distance / (band * .52), 2));
      const inset = wave * height * .105;
      const blend = Math.max(0, Math.min(1, .5 + distance / (band * .65)));
      const shift = direction * Math.sin(Math.min(1, Math.max(-1, distance / band)) * Math.PI) * wave * width * .025;
      const sx = Math.max(0, Math.min(a.width - 2, (x + shift) / width * a.width));
      const sw = Math.min(a.width - sx, a.width / width * 1.4);
      ctx.globalAlpha = 1;
      ctx.drawImage(a, sx, 0, sw, a.height, x, inset, 1.4, height - inset * 2);
      ctx.globalAlpha = blend;
      ctx.drawImage(b, sx, 0, sw, b.height, x, inset, 1.4, height - inset * 2);
      ctx.globalAlpha = 1;
      // Satin-like lavender highlight on the travelling fold, like the reference.
      ctx.fillStyle = `rgba(239,228,255,${wave * .48})`;
      ctx.fillRect(x, inset, 1.4, height - inset * 2);
      const shadow = Math.exp(-Math.pow((distance + band * .32) / (band * .22), 2));
      ctx.fillStyle = `rgba(47,29,61,${shadow * .15})`;
      ctx.fillRect(x, inset, 1.4, height - inset * 2);
    }
    cards[current].querySelector('.member-caption').style.opacity = String(Math.max(0, 1 - progress * 2));
  }
  function finish(commit) {
    cancelAnimationFrame(raf); animating = false; moving = false;
    team.classList.remove('is-folding', 'is-dragging');
    select(commit ? next : current); progress = 0;
  }
  function settle(commit) {
    moving = false; animating = true;
    const from = progress, to = commit ? 1 : 0;
    if (reduced.matches) { finish(commit); return; }
    const duration = Math.max(180, 850 * Math.abs(to - from));
    const start = performance.now();
    function tick(now) {
      const t = Math.min(1, (now - start) / duration);
      progress = from + (to - from) * (1 - Math.pow(1 - t, 3));
      paint();
      if (t < 1) raf = requestAnimationFrame(tick); else finish(commit);
    }
    raf = requestAnimationFrame(tick);
  }
  function go(i, dir) {
    if (moving || animating || i === current) return;
    next = (i + cards.length) % cards.length;
    direction = dir || (i > current ? 1 : -1); progress = 0;
    settle(true);
  }
  team.addEventListener('pointerdown', e => {
    if (animating || pointer || (e.pointerType === 'mouse' && e.button !== 0)) return;
    pointer = {id:e.pointerId, x:e.clientX, y:e.clientY, time:performance.now()};
  });
  team.addEventListener('pointermove', e => {
    if (!pointer || e.pointerId !== pointer.id) return;
    const dx = e.clientX - pointer.x, dy = e.clientY - pointer.y;
    if (!moving) {
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) { pointer = null; return; }
      if (Math.abs(dx) < 8) return;
      moving = true; team.classList.add('is-dragging');
      team.setPointerCapture(e.pointerId);
    }
    direction = dx < 0 ? 1 : -1;
    next = (current + direction + cards.length) % cards.length;
    progress = Math.min(1, Math.abs(dx) / (width * .85));
    if (!reduced.matches) paint();
  });
  function release(e, cancelled) {
    if (!pointer || pointer.id !== e.pointerId) return;
    const elapsed = performance.now() - pointer.time;
    const distance = Math.abs(e.clientX - pointer.x);
    pointer = null;
    if (moving) {
      suppressUntil = performance.now() + 400;
      settle(!cancelled && (progress > .22 || (distance > 24 && elapsed < 300)));
    }
    if (team.hasPointerCapture(e.pointerId)) team.releasePointerCapture(e.pointerId);
  }
  team.addEventListener('pointerup', e => release(e, false));
  team.addEventListener('pointercancel', e => release(e, true));
  team.addEventListener('lostpointercapture', () => { if (pointer && moving) { pointer = null; settle(false); } });
  team.addEventListener('click', e => {
    if (performance.now() < suppressUntil || moving || animating) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
  team.addEventListener('dragstart', e => e.preventDefault());
  team.addEventListener('keydown', e => {
    const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (dir) { e.preventDefault(); go((current + dir + cards.length) % cards.length, dir); }
  });
  select(0); size();
  new ResizeObserver(size).observe(team);
})();
