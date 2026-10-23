(() => {
  const root = document.documentElement;
  const scrollSelector = '.admin-shell, .bocc-admin-shell, body[data-order-page="qr"] .order-shell';

  function scrollWithKeyboard(event) {
    if (event.target !== event.currentTarget || !root.classList.contains('bocc-admin-viewport-clipped')) return;
    const container = event.currentTarget;
    const step = Math.max(120, Math.round(container.clientHeight * 0.8));
    const moves = { ArrowDown: 48, ArrowUp: -48, PageDown: step, PageUp: -step, Home: -Infinity, End: Infinity };
    if (!(event.key in moves)) return;
    event.preventDefault();
    if (event.key === 'Home') container.scrollTop = 0;
    else if (event.key === 'End') container.scrollTop = container.scrollHeight;
    else container.scrollTop += moves[event.key];
  }

  function syncKeyboardScroll() {
    const container = document.querySelector(scrollSelector);
    if (!container) return;

    if (root.classList.contains('bocc-admin-viewport-clipped')) {
      if (!container.hasAttribute('tabindex')) {
        container.tabIndex = 0;
        container.dataset.adminViewportFocus = '';
      }
      if (!('adminViewportKeys' in container.dataset)) {
        container.addEventListener('keydown', scrollWithKeyboard);
        container.dataset.adminViewportKeys = '';
      }
      if (!container.hasAttribute('aria-label')) {
        container.setAttribute('aria-label', 'Contenido administrativo desplazable');
        container.dataset.adminViewportLabel = '';
      }
    } else {
      if ('adminViewportFocus' in container.dataset) {
        container.removeAttribute('tabindex');
        delete container.dataset.adminViewportFocus;
      }
      if ('adminViewportLabel' in container.dataset) {
        container.removeAttribute('aria-label');
        delete container.dataset.adminViewportLabel;
      }
    }
  }

  function syncVisibleViewport() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const outerWidth = window.outerWidth || width;
    const outerHeight = window.outerHeight || height;
    const clipped = width > outerWidth + 16 || height > outerHeight + 16;

    root.classList.toggle('bocc-admin-viewport-clipped', clipped);
    if (!clipped) {
      root.style.removeProperty('--bocc-admin-visible-width');
      root.style.removeProperty('--bocc-admin-visible-height');
      syncKeyboardScroll();
      return;
    }

    root.style.setProperty('--bocc-admin-visible-width', `${Math.min(width, outerWidth)}px`);
    root.style.setProperty('--bocc-admin-visible-height', `${Math.min(height, Math.max(180, outerHeight - 140))}px`);
    syncKeyboardScroll();
  }

  syncVisibleViewport();
  new MutationObserver(syncKeyboardScroll).observe(document.body, { childList: true, subtree: true });
  window.addEventListener('resize', syncVisibleViewport, { passive: true });
  window.visualViewport?.addEventListener('resize', syncVisibleViewport, { passive: true });
})();
