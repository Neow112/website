(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const supportedLanguages = ['ru', 'kk', 'ug'];
  let lang = 'ru';

  const titles = {
    ru: 'SAPFIR — танцевальный ансамбль и шоу-балет в Алматы',
    kk: 'SAPFIR — Алматыдағы би ансамблі және шоу-балет',
    ug: 'SAPFIR — Алмутидики уссул ансамбли вә шоу-балет'
  };
  const descriptions = {
    ru: 'Танцевальный ансамбль SAPFIR в Алматы: современный танец, этно-фьюжн и шоу-танец. Фото участниц, видео выступлений и связь через WhatsApp.',
    kk: 'Алматыдағы SAPFIR би ансамблі: заманауи би, этно-фьюжн және шоу-би. Қатысушылардың фотолары, өнер көрсету бейнелері және WhatsApp арқылы байланыс.',
    ug: 'Алмутидики SAPFIR уссул ансамбли. Заманивий уссул, этно-фьюжн вә шоу-уссул. Қатнашқучиларниң сүрәтлири, оюн видеолири вә WhatsApp арқилиқ алақә.'
  };
  const whatsappMessages = {
    ru: 'Здравствуйте! Хотим пригласить ансамбль SAPFIR на мероприятие. Подскажите, пожалуйста, свободны ли вы и какая стоимость выступления?',
    kk: 'Сәлеметсіздер ме! SAPFIR ансамблін іс-шарамызға шақырғымыз келеді. Уақыттарыңыз бар ма және өнер көрсету құны қанша екенін айта аласыздар ма?',
    ug: 'Яхшимусиләр! SAPFIR ансамблини паалийитимизгә тәклип қилмақчимиз. Вақтиңлар барму вә оюн қоюш баһаси қанчә екәнлигини ейтип бәрсәңлар?'
  };

  function updateWhatsAppLanguage(value) {
    const message = whatsappMessages[value] || whatsappMessages.ru;
    $$('a[href^="https://wa.me/"]').forEach(link => {
      const url = new URL(link.href);
      url.searchParams.set('text', message);
      link.href = url.toString();
    });
  }

  function changeLanguage(value) {
    lang = supportedLanguages.includes(value) ? value : 'ru';
    document.documentElement.lang = lang === 'ug' ? 'ug-Cyrl' : lang;
    document.documentElement.dir = 'ltr';
    $$('[data-aria-ru]').forEach(el => el.setAttribute('aria-label', el.getAttribute(`data-aria-${lang}`)));
    $$('[data-alt-ru]').forEach(el => { el.alt = el.getAttribute(`data-alt-${lang}`); });
    const input = $(`#language-${lang}`);
    if (input) input.checked = true;
    updateWhatsAppLanguage(lang);
    document.title = titles[lang];
    const description = $('meta[name="description"]');
    if (description) description.content = descriptions[lang];
    if ($('#lightbox')?.open) renderLightbox();

  }

  // CSS owns the intro timeline; never restart it after a slow script download.
  (() => {
    const root = document.documentElement;
    const intro = $('#intro');
    const skip = $('#skip-intro');
    if (!intro || !skip || !root.classList.contains('intro-on')) return;
    const sections = $$('#header,main,.footer,.skip-link');
    let finished = false;
    let fallback;
    const endIntro = (restoreFocus = false) => {
      if (finished) return;
      finished = true;
      clearTimeout(fallback);
      root.classList.remove('intro-on');
      sections.forEach(el => { el.inert = false; });
      if (restoreFocus) $('.brand')?.focus({ preventScroll: true });
      else if (intro.contains(document.activeElement)) document.activeElement.blur();
    };
    const active = (intro.getAnimations?.() || []).find(animation =>
      animation.animationName === 'sapfir-intro-exit');
    if (reducedMotion.matches || getComputedStyle(intro).visibility === 'hidden' ||
        !active || active.playState === 'finished') {
      endIntro();
      return;
    }
    sections.forEach(el => { el.inert = true; });
    active.finished.then(() => endIntro(), () => endIntro());
    intro.addEventListener('animationend', event => {
      if (event.target === intro && event.animationName === 'sapfir-intro-exit') endIntro();
    });
    skip.addEventListener('click', event => endIntro(event.detail === 0));
    document.addEventListener('keydown', event => { if (event.key === 'Escape') endIntro(true); });
    reducedMotion.addEventListener?.('change', event => { if (event.matches) endIntro(); });
    // Fail open if the animation is interrupted or a browser misses its event.
    const remaining = Math.max(0, Number(active.effect.getComputedTiming().endTime) - Number(active.currentTime || 0));
    fallback = setTimeout(() => endIntro(), Math.min(remaining + 100, 3200));
  })();

  // Compact navigation.
  const menu = $('.menu-toggle');
  const nav = $('#nav');
  const closeMenu = () => {
    if (!menu || !nav) return;
    menu.setAttribute('aria-expanded', 'false');
    nav.classList.remove('open');
  };
  menu?.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    menu.setAttribute('aria-expanded', String(open));
  });
  $$('#nav a').forEach(link => link.addEventListener('click', () => {
    closeMenu();
    $$('#nav a').forEach(item => item.removeAttribute('aria-current'));
    link.setAttribute('aria-current', 'location');
  }));
  document.addEventListener('click', event => { if (!event.target.closest('header')) closeMenu(); });

  // One animation frame handles all page-level scrolling work.
  const header = $('#header');
  const hero = $('#home');
  let pageFrame = 0;
  function paintPage() {
    pageFrame = 0;
    header?.classList.toggle('scrolled', scrollY > 30);
    if (!hero) return;
    const y = Math.max(0, -hero.getBoundingClientRect().top);
    const distance = Math.min(160, innerHeight * 0.22);
    const progress = Math.min(1, y / Math.max(1, innerHeight * 0.42));
    hero.style.setProperty('--copy-shift', reducedMotion.matches ? '0px' : `${(-distance * progress).toFixed(2)}px`);
    hero.style.setProperty('--copy-shade', reducedMotion.matches ? '1' : (1 - progress).toFixed(3));
  }
  function schedulePagePaint() {
    if (!pageFrame) pageFrame = requestAnimationFrame(paintPage);
  }
  addEventListener('scroll', schedulePagePaint, { passive: true });
  addEventListener('resize', schedulePagePaint);
  if (reducedMotion.addEventListener) reducedMotion.addEventListener('change', schedulePagePaint);
  else reducedMotion.addListener(schedulePagePaint);

  // Gallery and lightbox.
  const galleryTrack = $('#gallery-track');
  const cards = $$('.gallery-card');
  const lightbox = $('#lightbox');
  let galleryIndex = 0;
  let lightIndex = 0;

  function syncGallery() {
    if (!galleryTrack || !cards.length) return;
    const center = galleryTrack.getBoundingClientRect().left + galleryTrack.clientWidth / 2;
    let best = Infinity;
    cards.forEach((card, index) => {
      const rect = card.getBoundingClientRect();
      const delta = Math.abs(rect.left + rect.width / 2 - center);
      if (delta < best) { best = delta; galleryIndex = index; }
    });
  }
  function moveGallery(delta) {
    if (!galleryTrack || !cards.length) return;
    const index = Math.max(0, Math.min(cards.length - 1, galleryIndex + delta));
    const cardRect = cards[index].getBoundingClientRect();
    const trackRect = galleryTrack.getBoundingClientRect();
    galleryTrack.scrollBy({
      left: cardRect.left + cardRect.width / 2 - trackRect.left - galleryTrack.clientWidth / 2,
      behavior: reducedMotion.matches ? 'auto' : 'smooth'
    });
    galleryIndex = index;
  }
  function renderLightbox() {
    if (!lightbox || !cards.length) return;
    const source = $('img', cards[lightIndex]);
    const image = $('img', lightbox);
    const caption = $('#lb-caption');
    image.style.filter = 'none';
    image.src = source.currentSrc || source.src;
    image.alt = source.alt;
    const captionSource = $('.gallery-caption > span', cards[lightIndex]);
    if (caption && captionSource) caption.textContent = captionSource.getAttribute(`data-${lang}`) || '';
  }
  function openDialog(dialog) {
    if (!dialog) return;
    dialog.showModal();
    document.body.classList.add('lock');
  }
  function shiftLightbox(delta) {
    if (!cards.length) return;
    lightIndex = (lightIndex + delta + cards.length) % cards.length;
    renderLightbox();
  }

  let galleryFrame = 0;
  galleryTrack?.addEventListener('scroll', () => {
    if (!galleryFrame) galleryFrame = requestAnimationFrame(() => { galleryFrame = 0; syncGallery(); });
  }, { passive: true });
  galleryTrack?.addEventListener('keydown', event => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      moveGallery(event.key === 'ArrowRight' ? 1 : -1);
    }
  });
  cards.forEach((card, index) => card.addEventListener('click', () => {
    lightIndex = index;
    renderLightbox();
    openDialog(lightbox);
  }));
  $('#lb-prev')?.addEventListener('click', () => shiftLightbox(-1));
  $('#lb-next')?.addEventListener('click', () => shiftLightbox(1));
  lightbox?.querySelector('.close')?.addEventListener('click', () => lightbox.close());
  lightbox?.addEventListener('close', () => document.body.classList.remove('lock'));
  lightbox?.addEventListener('click', event => {
    const rect = lightbox.getBoundingClientRect();
    if (event.target === lightbox && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) lightbox.close();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && nav?.classList.contains('open')) { closeMenu(); menu?.focus(); }
    if (lightbox?.open && (event.key === 'ArrowRight' || event.key === 'ArrowLeft')) {
      event.preventDefault();
      shiftLightbox(event.key === 'ArrowRight' ? 1 : -1);
    }
  });

  const lightboxImage = lightbox?.querySelector('img');
  let lightPointer = null, lightStartX = 0, lightStartY = 0;
  lightboxImage?.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'touch') return;
    lightPointer = event.pointerId;
    lightStartX = event.clientX;
    lightStartY = event.clientY;
    try { lightboxImage.setPointerCapture(event.pointerId); } catch {}
  });
  lightboxImage?.addEventListener('pointerup', event => {
    if (event.pointerId !== lightPointer) return;
    const dx = event.clientX - lightStartX;
    const dy = event.clientY - lightStartY;
    lightPointer = null;
    if (Math.abs(dx) >= 50 && Math.abs(dx) > Math.abs(dy) * 1.2) shiftLightbox(dx < 0 ? 1 : -1);
  });
  lightboxImage?.addEventListener('pointercancel', () => { lightPointer = null; });

  // Member portraits.
  (() => {
    const dialog = $('#member-modal');
    if (!dialog) return;
    const image = $('#member-image');
    const frame = $('#member-photo');
    const name = $('#member-name');
    const crop = $('.member-crop', frame);
    const fitMember = () => {
      if (!crop) return;
      const ratio = frame.classList.contains('is-screenshot') ? 646 / 1144 : 3 / 4;
      const width = Math.min(frame.clientWidth, frame.clientHeight * ratio);
      crop.style.width = `${width}px`;
      crop.style.height = `${width / ratio}px`;
    };
    $$('.member-open').forEach(button => button.addEventListener('click', () => {
      const source = $('img', button);
      image.src = source.currentSrc || source.src;
      image.alt = source.alt;
      name.textContent = $('h3', button.closest('.member'))?.getAttribute(`data-${lang}`) || $('h3', button.closest('.member'))?.getAttribute('data-ru') || '';
      frame.classList.toggle('is-screenshot', button.dataset.member === '2');
      dialog.showModal();
      document.body.classList.add('lock');
      fitMember();
    }));
    if ('ResizeObserver' in window) new ResizeObserver(fitMember).observe(frame);
    dialog.querySelector('.close')?.addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => document.body.classList.remove('lock'));
    dialog.addEventListener('click', event => {
      const rect = dialog.getBoundingClientRect();
      if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
    });
  })();

  // YouTube is only instantiated after the visitor asks to play it.
  const poster = $('.video-poster');
  const videoFrame = $('.shorts-screen iframe');
  poster?.addEventListener('click', () => {
    videoFrame.src = videoFrame.dataset.src;
    videoFrame.hidden = false;
    poster.hidden = true;
    videoFrame.focus();
  });

  // Mouse drag for horizontally scrollable collections.
  function enableMouseDrag(track) {
    if (!track) return;
    let down = false, start = 0, left = 0, moved = false;
    track.addEventListener('pointerdown', event => {
      if (event.pointerType !== 'mouse' || event.button !== 0) return;
      down = true; moved = false; start = event.clientX; left = track.scrollLeft;
    });
    addEventListener('pointermove', event => {
      if (!down) return;
      if (Math.abs(event.clientX - start) > 6) {
        moved = true;
        track.classList.add('dragging');
        track.scrollLeft = left - (event.clientX - start);
      }
    });
    addEventListener('pointerup', () => {
      if (!down) return;
      down = false;
      track.classList.remove('dragging');
      setTimeout(() => { moved = false; }, 0);
    });
    track.addEventListener('click', event => {
      if (moved) { event.preventDefault(); event.stopImmediatePropagation(); }
    }, true);
    track.addEventListener('dragstart', event => event.preventDefault());
  }
  enableMouseDrag(galleryTrack);
  enableMouseDrag($('.team'));

  // Media/context-menu protection requested for the public site.
  const isProtectedMedia = target => {
    if (!(target instanceof Element)) return false;
    if (target.tagName === 'IMG' || target.tagName === 'IMAGE') return true;
    return !!target.closest('picture,.hero-image,.gallery-photo,.portrait,.member-photo,#lightbox,.video-poster,.intro-picture');
  };
  $$('img').forEach(image => image.setAttribute('draggable', 'false'));
  document.addEventListener('contextmenu', event => { if (isProtectedMedia(event.target)) event.preventDefault(); }, { capture: true });
  document.addEventListener('dragstart', event => { if (isProtectedMedia(event.target)) event.preventDefault(); }, { capture: true });

  // Copy protection: site text is blocked; phone numbers remain copyable.
  const phoneSelector = '.wa-number';
  const phoneElement = node => {
    if (!node) return null;
    const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    return element?.closest ? element.closest(phoneSelector) : null;
  };
  const selectionIsPhoneOnly = () => {
    const selection = getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return false;
    const anchor = phoneElement(selection.anchorNode);
    const focus = phoneElement(selection.focusNode);
    return !!(anchor && focus && anchor === focus);
  };
  document.addEventListener('selectstart', event => {
    const target = event.target instanceof Element ? event.target : null;
    if (!(target && (target.closest(phoneSelector) || target.closest('[data-copy-helper]')))) event.preventDefault();
  }, true);
  let fallbackCopyText = null;
  document.addEventListener('copy', event => {
    if (fallbackCopyText !== null) {
      if (event.clipboardData) {
        event.clipboardData.setData('text/plain', fallbackCopyText);
        event.preventDefault();
      }
      return;
    }
    if (!selectionIsPhoneOnly()) event.preventDefault();
  }, true);
  document.addEventListener('cut', event => event.preventDefault(), true);

  let toast = $('.copy-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'copy-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    document.body.appendChild(toast);
  }
  let toastTimer = 0;
  const showToast = text => {
    toast.textContent = text;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 1500);
  };
  const copiedMessage = () => lang === 'kk' ? 'Нөмір көшірілді' : lang === 'ug' ? 'Номер көчүрүлди' : 'Номер скопирован';
  const copyFailedMessage = () => lang === 'kk' ? 'Нөмір көшірілмеді. Нөмірді белгілеп, көшіріңіз.' : lang === 'ug' ? 'Номер көчүрүлмиди. Номерни бәлгүләп көчүрүң.' : 'Не удалось скопировать. Выделите номер и скопируйте вручную.';
  async function copyPhone(element) {
    const text = element.textContent.replace(/\s+/g, ' ').trim();
    let copied = false;
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
    } catch {
      const previousFocus = document.activeElement;
      const helper = document.createElement('textarea');
      helper.value = text;
      helper.readOnly = true;
      helper.dataset.copyHelper = '';
      helper.style.cssText = 'position:fixed;left:0;top:0;opacity:0;pointer-events:none;user-select:text';
      document.body.appendChild(helper);
      try {
        helper.select();
        fallbackCopyText = text;
        copied = document.execCommand('copy') === true;
      } catch { copied = false; }
      finally {
        fallbackCopyText = null;
        helper.remove();
        previousFocus?.focus?.({ preventScroll: true });
      }
    }
    showToast(copied ? copiedMessage() : copyFailedMessage());
  }
  $$('[data-copy-phone]').forEach(button => button.addEventListener('click', () => {
    const number = document.getElementById(button.dataset.copyPhone);
    if (number) copyPhone(number);
  }));
  let hold = null;
  let suppressPhoneClick = false;
  document.addEventListener('pointerdown', event => {
    const element = event.target instanceof Element ? event.target.closest(phoneSelector) : null;
    if (!element || event.pointerType === 'mouse') return;
    hold = { element, id: event.pointerId, x: event.clientX, y: event.clientY, time: performance.now() };
  }, true);
  document.addEventListener('pointermove', event => {
    if (hold && event.pointerId === hold.id && Math.hypot(event.clientX - hold.x, event.clientY - hold.y) > 12) hold = null;
  }, true);
  document.addEventListener('pointercancel', () => { hold = null; }, true);
  document.addEventListener('pointerup', event => {
    if (!hold || event.pointerId !== hold.id) return;
    const current = hold;
    hold = null;
    if (performance.now() - current.time >= 520) {
      suppressPhoneClick = true;
      copyPhone(current.element);
      event.preventDefault();
      setTimeout(() => { suppressPhoneClick = false; }, 500);
    }
  }, true);
  document.addEventListener('click', event => {
    if (suppressPhoneClick && event.target instanceof Element && event.target.closest(phoneSelector)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      suppressPhoneClick = false;
    }
  }, true);

  changeLanguage(document.documentElement.lang.split('-')[0]);
  syncGallery();
  paintPage();
})();
