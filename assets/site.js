(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const language = document.documentElement.lang.split('-')[0];

  const errorMessages = {
    ru: 'Фото не загрузилось. Попробуйте ещё раз.',
    kk: 'Фото жүктелмеді. Қайталап көріңіз.',
    ug: 'Сүрәт жүкләнмиди. Қайта синап көрүң.'
  };

  // Intro lifecycle. CSS owns the timeline; JS only manages focus and inert state.
  (() => {
    const root = document.documentElement;
    const intro = $('#intro');
    const skip = $('#skip-intro');
    if (!intro || !skip || !root.classList.contains('intro-on')) return;

    const sections = $$('#header, main, .footer, .skip-link');
    let finished = false;
    let fallbackTimer = 0;

    const finish = (restoreFocus = false) => {
      if (finished) return;
      finished = true;
      clearTimeout(fallbackTimer);
      root.classList.remove('intro-on');
      sections.forEach(section => { section.inert = false; });
      if (restoreFocus) $('.brand')?.focus({ preventScroll: true });
      else if (intro.contains(document.activeElement)) document.activeElement.blur();
    };

    const animation = (intro.getAnimations?.() || []).find(item => item.animationName === 'sapfir-intro-exit');
    if (reducedMotion.matches || getComputedStyle(intro).visibility === 'hidden' || !animation || animation.playState === 'finished') {
      finish();
      return;
    }

    sections.forEach(section => { section.inert = true; });
    animation.finished.then(() => finish(), () => finish());
    intro.addEventListener('animationend', event => {
      if (event.target === intro && event.animationName === 'sapfir-intro-exit') finish();
    });
    skip.addEventListener('click', event => finish(event.detail === 0));
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') finish(true);
    });
    reducedMotion.addEventListener?.('change', event => {
      if (event.matches) finish();
    });

    const timing = animation.effect.getComputedTiming();
    const remaining = Math.max(0, Number(timing.endTime) - Number(animation.currentTime || 0));
    fallbackTimer = setTimeout(finish, Math.min(remaining + 120, 3600));
  })();

  // Skip the intro exactly once when changing language within the same tab.
  $$('.langs a[data-lang]').forEach(link => {
    link.addEventListener('click', event => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const target = new URL(link.href);
      if (target.origin !== location.origin) return;
      if (target.pathname === location.pathname) {
        event.preventDefault();
        return;
      }
      try {
        sessionStorage.setItem('sapfir-language-transition', JSON.stringify({ path: target.pathname, at: Date.now() }));
      } catch {}
    });
  });

  // Compact navigation.
  const menuButton = $('.menu-toggle');
  const navigation = $('#nav');

  const closeMenu = () => {
    if (!menuButton || !navigation) return;
    menuButton.setAttribute('aria-expanded', 'false');
    navigation.classList.remove('open');
  };

  menuButton?.addEventListener('click', () => {
    const open = navigation.classList.toggle('open');
    menuButton.setAttribute('aria-expanded', String(open));
  });

  $$('#nav a').forEach(link => {
    link.addEventListener('click', () => {
      closeMenu();
      $$('#nav a').forEach(item => item.removeAttribute('aria-current'));
      link.setAttribute('aria-current', 'location');
    });
  });

  document.addEventListener('click', event => {
    if (event.target instanceof Element && !event.target.closest('header')) closeMenu();
  });

  // Header state and first-screen motion share one animation frame.
  const header = $('#header');
  const hero = $('#home');
  let pageFrame = 0;

  const paintPage = () => {
    pageFrame = 0;
    header?.classList.toggle('scrolled', scrollY > 30);
    if (!hero) return;

    const y = Math.max(0, -hero.getBoundingClientRect().top);
    const distance = Math.min(160, innerHeight * 0.22);
    const progress = Math.min(1, y / Math.max(1, innerHeight * 0.42));
    const shift = reducedMotion.matches ? 0 : -distance * progress;
    hero.style.setProperty('--copy-shift', `${shift.toFixed(2)}px`);
  };

  const schedulePagePaint = () => {
    if (!pageFrame) pageFrame = requestAnimationFrame(paintPage);
  };

  addEventListener('scroll', schedulePagePaint, { passive: true });
  addEventListener('resize', schedulePagePaint, { passive: true });
  if (reducedMotion.addEventListener) reducedMotion.addEventListener('change', schedulePagePaint);
  else reducedMotion.addListener(schedulePagePaint);

  // Gallery and lightbox.
  const galleryTrack = $('#gallery-track');
  const galleryCards = $$('.gallery-card');
  const lightbox = $('#lightbox');
  const lightboxImage = lightbox?.querySelector('img');
  const lightboxCaption = $('#lb-caption');
  let galleryIndex = 0;
  let lightboxIndex = 0;
  let displayedLightboxIndex = null;
  let lightboxVersion = 0;
  let lightboxAnimation = null;
  let naturalWidth = 0;
  let naturalHeight = 0;

  const syncGallery = () => {
    if (!galleryTrack || !galleryCards.length) return;
    const center = galleryTrack.getBoundingClientRect().left + galleryTrack.clientWidth / 2;
    let nearest = Infinity;
    galleryCards.forEach((card, index) => {
      const rect = card.getBoundingClientRect();
      const distance = Math.abs(rect.left + rect.width / 2 - center);
      if (distance < nearest) {
        nearest = distance;
        galleryIndex = index;
      }
    });
  };

  const moveGallery = delta => {
    if (!galleryTrack || !galleryCards.length) return;
    const index = Math.max(0, Math.min(galleryCards.length - 1, galleryIndex + delta));
    const cardRect = galleryCards[index].getBoundingClientRect();
    const trackRect = galleryTrack.getBoundingClientRect();
    galleryTrack.scrollBy({
      left: cardRect.left + cardRect.width / 2 - trackRect.left - galleryTrack.clientWidth / 2,
      behavior: reducedMotion.matches ? 'auto' : 'smooth'
    });
    galleryIndex = index;
  };

  const sizeLightbox = (width, height) => {
    if (!lightbox || !width || !height) return;
    naturalWidth = width;
    naturalHeight = height;

    if (matchMedia('(max-width: 680px)').matches) {
      lightbox.style.removeProperty('--lb-image-width');
      return;
    }

    const ratio = width / height;
    const maxHeight = Math.max(320, innerHeight * 0.72);
    const maxWidth = Math.max(360, Math.min(innerWidth * 0.82, 1050));
    const desiredWidth = Math.max(280, Math.min(maxWidth, maxHeight * ratio));
    lightbox.style.setProperty('--lb-image-width', `${Math.round(desiredWidth)}px`);
  };

  const renderLightbox = async (direction = 0) => {
    if (!lightbox?.open || !lightboxImage || !galleryCards.length) return;

    const version = ++lightboxVersion;
    const index = lightboxIndex;
    const source = $('img', galleryCards[index]);
    const url = source.currentSrc || source.src;

    lightboxAnimation?.cancel();
    lightboxAnimation = null;
    lightbox.setAttribute('aria-busy', 'true');

    try {
      const preload = new Image();
      const loaded = new Promise((resolve, reject) => {
        preload.onload = resolve;
        preload.onerror = reject;
      });
      preload.src = url;
      await loaded;
      await preload.decode?.().catch(() => {});
      sizeLightbox(preload.naturalWidth, preload.naturalHeight);
    } catch {
      if (version !== lightboxVersion) return;
      lightbox.removeAttribute('aria-busy');
      if (displayedLightboxIndex !== null) lightboxIndex = displayedLightboxIndex;
      if (lightboxCaption) lightboxCaption.textContent = errorMessages[language] || errorMessages.ru;
      return;
    }

    if (version !== lightboxVersion || !lightbox.open) return;

    if (direction && displayedLightboxIndex !== null && !reducedMotion.matches && lightboxImage.animate) {
      lightboxAnimation = lightboxImage.animate([
        { opacity: 1, transform: 'translateX(0)' },
        { opacity: 0, transform: `translateX(${-direction * 10}px)` }
      ], { duration: 220, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
      await lightboxAnimation.finished.catch(() => {});
    }

    if (version !== lightboxVersion || !lightbox.open) return;
    lightboxAnimation?.cancel();
    lightboxImage.src = url;
    lightboxImage.alt = source.alt;
    displayedLightboxIndex = index;

    const caption = $('.gallery-caption > span', galleryCards[index]);
    if (lightboxCaption) lightboxCaption.textContent = caption?.textContent.trim() || '';
    lightbox.removeAttribute('aria-busy');

    if (!reducedMotion.matches && lightboxImage.animate) {
      lightboxAnimation = lightboxImage.animate([
        { opacity: 0, transform: `translateX(${direction * 10}px) scale(.998)` },
        { opacity: 1, transform: 'translateX(0) scale(1)' }
      ], { duration: 420, easing: 'cubic-bezier(.22,1,.36,1)' });
      lightboxAnimation.finished.catch(() => {});
    }
  };

  const openDialog = dialog => {
    if (!dialog || dialog.open) return;
    dialog.showModal();
    document.body.classList.add('lock');
  };

  const shiftLightbox = delta => {
    if (!galleryCards.length) return;
    lightboxIndex = (lightboxIndex + delta + galleryCards.length) % galleryCards.length;
    renderLightbox(Math.sign(delta));
  };

  let galleryFrame = 0;
  galleryTrack?.addEventListener('scroll', () => {
    if (!galleryFrame) {
      galleryFrame = requestAnimationFrame(() => {
        galleryFrame = 0;
        syncGallery();
      });
    }
  }, { passive: true });

  galleryTrack?.addEventListener('keydown', event => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    moveGallery(event.key === 'ArrowRight' ? 1 : -1);
  });

  galleryCards.forEach((card, index) => {
    card.addEventListener('click', () => {
      lightboxIndex = index;
      openDialog(lightbox);
      renderLightbox();
    });
  });

  $('#lb-prev')?.addEventListener('click', () => shiftLightbox(-1));
  $('#lb-next')?.addEventListener('click', () => shiftLightbox(1));
  lightbox?.querySelector('.close')?.addEventListener('click', () => lightbox.close());

  lightbox?.addEventListener('close', () => {
    ++lightboxVersion;
    lightboxAnimation?.cancel();
    lightboxAnimation = null;
    displayedLightboxIndex = null;
    naturalWidth = 0;
    naturalHeight = 0;
    lightbox.style.removeProperty('--lb-image-width');
    lightboxImage?.removeAttribute('src');
    lightbox.removeAttribute('aria-busy');
    document.body.classList.remove('lock');
  });

  lightbox?.addEventListener('click', event => {
    const rect = lightbox.getBoundingClientRect();
    const outside = event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
    if (event.target === lightbox && outside) lightbox.close();
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && navigation?.classList.contains('open')) {
      closeMenu();
      menuButton?.focus();
    }
    if (lightbox?.open && (event.key === 'ArrowRight' || event.key === 'ArrowLeft')) {
      event.preventDefault();
      shiftLightbox(event.key === 'ArrowRight' ? 1 : -1);
    }
  });

  let swipePointer = null;
  let swipeStartX = 0;
  let swipeStartY = 0;

  lightboxImage?.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'touch') return;
    swipePointer = event.pointerId;
    swipeStartX = event.clientX;
    swipeStartY = event.clientY;
    try { lightboxImage.setPointerCapture(event.pointerId); } catch {}
  });

  lightboxImage?.addEventListener('pointerup', event => {
    if (event.pointerId !== swipePointer) return;
    const dx = event.clientX - swipeStartX;
    const dy = event.clientY - swipeStartY;
    swipePointer = null;
    if (Math.abs(dx) >= 50 && Math.abs(dx) > Math.abs(dy) * 1.2) shiftLightbox(dx < 0 ? 1 : -1);
  });

  lightboxImage?.addEventListener('pointercancel', () => { swipePointer = null; });

  addEventListener('resize', () => {
    if (lightbox?.open && naturalWidth && naturalHeight) sizeLightbox(naturalWidth, naturalHeight);
  }, { passive: true });

  reducedMotion.addEventListener?.('change', event => {
    if (event.matches) lightboxAnimation?.cancel();
  });

  // Member portraits.
  (() => {
    const dialog = $('#member-modal');
    const frame = $('#member-photo');
    const crop = frame ? $('.member-crop', frame) : null;
    const image = $('#member-image');
    const name = $('#member-name');
    if (!dialog || !frame || !crop || !image || !name) return;

    const fitMember = () => {
      const ratio = frame.classList.contains('is-screenshot') ? 646 / 1144 : 3 / 4;
      const width = Math.min(frame.clientWidth, frame.clientHeight * ratio);
      crop.style.width = `${width}px`;
      crop.style.height = `${width / ratio}px`;
    };

    $$('.member-open').forEach(button => {
      button.addEventListener('click', () => {
        const source = $('img', button);
        const heading = $('h3', button.closest('.member'));
        image.src = source.currentSrc || source.src;
        image.alt = source.alt;
        name.textContent = heading?.textContent.trim() || '';
        frame.classList.toggle('is-screenshot', button.dataset.member === '2');
        openDialog(dialog);
        fitMember();
      });
    });

    if ('ResizeObserver' in window) new ResizeObserver(fitMember).observe(frame);
    dialog.querySelector('.close')?.addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => document.body.classList.remove('lock'));
    dialog.addEventListener('click', event => {
      const rect = dialog.getBoundingClientRect();
      const outside = event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
      if (event.target === dialog && outside) dialog.close();
    });
  })();

  // YouTube iframe is created only after the visitor presses Play.
  const poster = $('.video-poster');
  const videoFrame = $('.shorts-screen iframe');
  poster?.addEventListener('click', () => {
    videoFrame.src = videoFrame.dataset.src;
    videoFrame.hidden = false;
    poster.hidden = true;
    videoFrame.focus();
  });

  // Pointer drag for horizontally scrollable desktop collections.
  const enableMouseDrag = track => {
    if (!track) return;
    let pointerId = null;
    let startX = 0;
    let startScroll = 0;
    let moved = false;

    const finish = () => {
      if (pointerId === null) return;
      pointerId = null;
      track.classList.remove('dragging');
      setTimeout(() => { moved = false; }, 0);
    };

    track.addEventListener('pointerdown', event => {
      if (event.pointerType !== 'mouse' || event.button !== 0) return;
      pointerId = event.pointerId;
      startX = event.clientX;
      startScroll = track.scrollLeft;
      moved = false;
      try { track.setPointerCapture(pointerId); } catch {}
    });

    track.addEventListener('pointermove', event => {
      if (event.pointerId !== pointerId) return;
      if (Math.abs(event.clientX - startX) <= 6) return;
      moved = true;
      track.classList.add('dragging');
      track.scrollLeft = startScroll - (event.clientX - startX);
    });

    track.addEventListener('pointerup', finish);
    track.addEventListener('pointercancel', finish);
    track.addEventListener('click', event => {
      if (!moved) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);
    track.addEventListener('dragstart', event => event.preventDefault());
  };

  enableMouseDrag(galleryTrack);
  enableMouseDrag($('.team'));

  // Public-site UI protection. This discourages casual saving/copying; it is not DRM.
  const isProtectedMedia = target => {
    if (!(target instanceof Element)) return false;
    if (target.tagName === 'IMG' || target.tagName === 'IMAGE') return true;
    return Boolean(target.closest('picture, .hero-image, .gallery-photo, .portrait, .member-photo, #lightbox, .video-poster, .intro-picture'));
  };

  $$('img').forEach(image => image.setAttribute('draggable', 'false'));
  document.addEventListener('contextmenu', event => {
    if (isProtectedMedia(event.target)) event.preventDefault();
  }, { capture: true });
  document.addEventListener('dragstart', event => {
    if (isProtectedMedia(event.target)) event.preventDefault();
  }, { capture: true });

  // Text selection/copy is blocked everywhere except the displayed phone numbers.
  const phoneSelector = '.wa-number';
  const closestPhone = node => {
    const element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
    return element?.closest?.(phoneSelector) || null;
  };
  const selectionIsSinglePhone = () => {
    const selection = getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return false;
    const anchor = closestPhone(selection.anchorNode);
    const focus = closestPhone(selection.focusNode);
    return Boolean(anchor && focus && anchor === focus);
  };

  document.addEventListener('selectstart', event => {
    if (!(event.target instanceof Element) || !event.target.closest(phoneSelector)) event.preventDefault();
  }, true);
  document.addEventListener('copy', event => {
    if (!selectionIsSinglePhone()) event.preventDefault();
  }, true);
  document.addEventListener('cut', event => event.preventDefault(), true);

  syncGallery();
  paintPage();
})();
