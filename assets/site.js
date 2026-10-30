(() => {
  'use strict';
  const $ = (s, parent = document) => parent.querySelector(s);
  const $$ = (s, parent = document) => [...parent.querySelectorAll(s)];
  const strings = JSON.parse($('#site-strings').textContent);
  const root = document.documentElement;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let userPaused = false;
  try { userPaused = localStorage.getItem('sapfir-motion') === 'paused'; } catch {}
  const motionButton = $('.motion-toggle');
  const syncMotion = () => {
    const paused = userPaused || reduceMotion.matches;
    root.classList.toggle('motion-paused', paused);
    motionButton.setAttribute('aria-pressed', String(paused));
    motionButton.disabled = reduceMotion.matches;
    const label = reduceMotion.matches ? strings.motion_system : paused ? strings.motion_resume : strings.motion_pause;
    motionButton.setAttribute('aria-label', label);
    motionButton.title = label;
    $('use', motionButton).setAttribute('href', paused ? '#i-play' : '#i-pause');
  };
  syncMotion();
  motionButton.addEventListener('click', () => {
    userPaused = !userPaused;
    try { localStorage.setItem('sapfir-motion', userPaused ? 'paused' : 'on'); } catch {}
    syncMotion();
  });
  reduceMotion.addEventListener('change', syncMotion);
  document.addEventListener('visibilitychange', () => root.classList.toggle('page-hidden', document.hidden));

  if ('IntersectionObserver' in window) {
    const reveal = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) { entry.target.classList.add('visible'); reveal.unobserve(entry.target); }
      });
    }, { threshold: 0.06, rootMargin: '0px 0px -16px 0px' });
    $$('.reveal').forEach(el => reveal.observe(el));
    root.classList.add('motion-ready');
  }

  const header = $('.site-header');
  const menuTrigger = $('.menu-trigger');
  const menu = $('#mobile-menu');
  const closeMenu = () => {
    menu.hidden = true;
    menuTrigger.setAttribute('aria-expanded', 'false');
    menuTrigger.setAttribute('aria-label', strings.menu_open);
    $('use', menuTrigger).setAttribute('href', '#i-menu');
  };
  menuTrigger.addEventListener('click', () => {
    const open = menu.hidden;
    menu.hidden = !open;
    menuTrigger.setAttribute('aria-expanded', String(open));
    menuTrigger.setAttribute('aria-label', open ? strings.menu_close : strings.menu_open);
    $('use', menuTrigger).setAttribute('href', open ? '#i-close' : '#i-menu');
  });
  $$('a', menu).forEach(a => a.addEventListener('click', closeMenu));
  document.addEventListener('click', event => {
    if (!header.contains(event.target)) closeMenu();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !menu.hidden) { closeMenu(); menuTrigger.focus({ preventScroll: true }); }
  });
  matchMedia('(min-width: 761px)').addEventListener('change', event => { if (event.matches) closeMenu(); });
  $$('[data-language]').forEach(link => link.addEventListener('click', () => {
    if (location.hash && document.getElementById(location.hash.slice(1))) link.hash = location.hash;
  }));

  const hero = $('.hero');
  let scrollPending = false;
  const updateScroll = () => {
    const scroll = window.scrollY;
    header.classList.toggle('scrolled', scroll > 48);
    scrollPending = false;
  };
  window.addEventListener('scroll', () => { if (!scrollPending) { scrollPending = true; requestAnimationFrame(updateScroll); } }, { passive: true });
  window.addEventListener('resize', updateScroll, { passive: true });
  updateScroll();
  if ('IntersectionObserver' in window) {
    const sections = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) $$('.desktop-nav a').forEach(a => {
          const active = a.hash === '#' + entry.target.id;
          a.classList.toggle('active', active);
          if (active) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-15% 0px -55% 0px', threshold: 0 });
    $$('main section[id]').forEach(el => sections.observe(el));
  }
  const pointerFine = matchMedia('(hover: hover) and (pointer: fine) and (min-width: 761px)');
  let pointerPending = false;
  hero.addEventListener('pointermove', event => {
    if (!pointerFine.matches || root.classList.contains('motion-paused') || pointerPending) return;
    pointerPending = true;
    const rect = hero.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - .5) * 5;
    const y = ((event.clientY - rect.top) / rect.height - .5) * 3;
    requestAnimationFrame(() => { hero.style.setProperty('--px', `${x}px`); hero.style.setProperty('--py', `${y}px`); pointerPending = false; });
  }, { passive: true });
  hero.addEventListener('pointerleave', () => { hero.style.setProperty('--px', '0px'); hero.style.setProperty('--py', '0px'); });

  const lightbox = $('#lightbox');
  const photo = $('#lightbox-image');
  const imageWrap = $('.lightbox-image-wrap');
  const photoStage = $('.photo-stage');
  const fitPhotoStage = () => {
    if (!lightbox.open || !photo.naturalWidth) return;
    const availableWidth = imageWrap.clientWidth * (innerWidth <= 760 ? .86 : .72);
    const availableHeight = imageWrap.clientHeight * .88;
    const ratio = photo.naturalWidth / photo.naturalHeight;
    const width = Math.min(availableWidth, availableHeight * ratio);
    photoStage.style.width = `${width}px`;
    photoStage.style.height = `${width / ratio}px`;
  };
  photo.addEventListener('load', fitPhotoStage);
  new ResizeObserver(fitPhotoStage).observe(imageWrap);
  const ribbonPoses = {
    nigara: [-11, 1, -5, 9, 0], diyara: [8, -1, 4, -7, 5],
    niyara: [-18, -1, -7, 14, -4], mira: [15, 1, 6, -10, 8],
    yasmina: [-6, -1, 8, 18, -6], araylym: [21, 1, -8, -15, 3],
    sabrina: [-23, 1, 2, 6, 10], tamilla: [5, -1, -4, -19, -8]
  };
  const counter = $('#lightbox-counter');
  const caption = $('#lightbox-caption');
  let activePhotos = [];
  let photoIndex = 0;
  let opener = null;
  const lockBody = () => document.body.classList.add('modal-open');
  const unlockBody = () => { if (!$('dialog[open]')) document.body.classList.remove('modal-open'); };
  const resetZoom = () => { imageWrap.scrollTo(0, 0); };
  const showPhoto = () => {
    resetZoom();
    const link = activePhotos[photoIndex];
    const person = link.closest('[data-person]')?.dataset.person;
    const pose = ribbonPoses[person] || Object.values(ribbonPoses)[photoIndex % 8];
    lightbox.dataset.person = person || 'gallery';
    ['--ribbon-angle','--ribbon-flip','--ribbon-x','--front-angle','--front-y'].forEach((name,i) => {
      photoStage.style.setProperty(name, String(pose[i]) + (i === 1 ? '' : i === 0 || i === 3 ? 'deg' : '%'));
    });
    photo.src = link.href;
    photo.alt = link.dataset.caption || $('img', link).alt;
    caption.textContent = link.dataset.caption || '';
    counter.textContent = `${String(photoIndex + 1).padStart(2, '0')} / ${String(activePhotos.length).padStart(2, '0')}`;
    $('[data-previous]').disabled = activePhotos.length < 2;
    $('[data-next]').disabled = activePhotos.length < 2;
  };
  const navigatePhoto = delta => { photoIndex = (photoIndex + delta + activePhotos.length) % activePhotos.length; showPhoto(); };
  $$('[data-lightbox]').forEach(link => link.addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || typeof lightbox.showModal !== 'function') return;
    event.preventDefault();
    activePhotos = $$('[data-lightbox]').filter(el => el.dataset.lightbox === link.dataset.lightbox);
    photoIndex = activePhotos.indexOf(link);
    opener = link;
    showPhoto();
    lightbox.showModal();
    requestAnimationFrame(fitPhotoStage);
    lockBody();
    $('[data-close]').focus({ preventScroll: true });
  }));
  $('[data-close]').addEventListener('click', () => lightbox.close());
  $('[data-previous]').addEventListener('click', () => navigatePhoto(-1));
  $('[data-next]').addEventListener('click', () => navigatePhoto(1));
  lightbox.addEventListener('click', event => { if (event.target === lightbox) lightbox.close(); });
  lightbox.addEventListener('close', () => { unlockBody(); resetZoom(); if (opener) opener.focus({ preventScroll: true }); });
  lightbox.addEventListener('keydown', event => {
    if (imageWrap.classList.contains('zoomed')) return;
    if (event.key === 'ArrowLeft') { event.preventDefault(); navigatePhoto(-1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); navigatePhoto(1); }
  });
  let startX = null;
  let startY = null;
  imageWrap.addEventListener('touchstart', event => { if (event.touches.length !== 1) { startX = null; return; } startX = event.touches[0].clientX; startY = event.touches[0].clientY; }, { passive: true });
  imageWrap.addEventListener('touchend', event => {
    if (startX === null || imageWrap.classList.contains('zoomed')) return;
    const dx = event.changedTouches[0].clientX - startX;
    const dy = event.changedTouches[0].clientY - startY;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) navigatePhoto(dx < 0 ? 1 : -1);
    startX = null;
  }, { passive: true });
  photo.addEventListener('error', () => {
    caption.replaceChildren(document.createTextNode(strings.photo_error + ' '));
    const link = document.createElement('a'); link.href = activePhotos[photoIndex].href; link.textContent = strings.open_photo; link.target = '_blank'; link.rel = 'noopener noreferrer'; caption.append(link);
  });

  const videoDialog = $('#video-dialog');
  const frameContainer = $('.video-frame-container');
  $('[data-open-video]').addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || typeof videoDialog.showModal !== 'function') return;
    event.preventDefault();
    const frame = document.createElement('iframe');
    frame.src = 'https://www.youtube-nocookie.com/embed/sjH-zabbUC0?playsinline=1&rel=0&autoplay=1';
    frame.title = 'SAPFIR — ' + strings.watch;
    frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    frame.allowFullscreen = true;
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    frameContainer.replaceChildren(frame);
    videoDialog.showModal(); lockBody();
    $('[data-close-video]').focus({ preventScroll: true });
  });
  $('[data-close-video]').addEventListener('click', () => videoDialog.close());
  videoDialog.addEventListener('click', event => { if (event.target === videoDialog) videoDialog.close(); });
  videoDialog.addEventListener('close', () => { frameContainer.replaceChildren(); unlockBody(); $('[data-open-video]').focus({ preventScroll: true }); });

  $('[data-year]').textContent = String(new Date().getFullYear());
})();
