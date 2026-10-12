(() => {
  const variant = new URLSearchParams(window.location.search).get('hero')?.toLowerCase();
  if (!['a', 'b'].includes(variant)) return;

  const page = document.querySelector('.elementor.elementor-1187');
  if (!page || page.querySelector('.bocc-hero')) return;

  [...page.children].slice(0, 2).forEach((element) => element.classList.add('bocc-original-hero'));
  document.body.dataset.boccantinaHero = variant;
  document.title = `Propuesta ${variant.toUpperCase()} — Boccantina`;

  if (variant === 'a') {
    document.querySelectorAll('a[href]').forEach((link) => {
      try {
        const target = new URL(link.href, window.location.href);
        const normalizedPath = target.pathname.replace(/index\.html$/i, '');
        if (target.origin === window.location.origin && normalizedPath === '/reservaciones/') {
          link.setAttribute('href', '/reservaciones/?hero=a');
        }
      } catch {
        // Ignore malformed links inherited from the mirrored WordPress page.
      }
    });
  }

  const hero = document.createElement('section');
  hero.className = `bocc-hero bocc-hero--${variant}`;
  hero.setAttribute('aria-labelledby', `bocc-hero-${variant}-title`);

  if (variant === 'a') {
    hero.innerHTML = `
      <div class="bocc-hero__backdrop" aria-hidden="true"></div>
      <div class="bocc-hero__frame">
        <div class="bocc-hero__content">
          <p class="bocc-hero__context">Cantina de vinos en Belén, Heredia</p>
          <h1 id="bocc-hero-a-title">Vino, cocina y una mesa para quedarse.</h1>
          <p class="bocc-hero__intro">Una invitación a descubrir Boccantina entre copas, platos para compartir y una atmósfera hecha para la noche.</p>
          <div class="bocc-hero__actions" aria-label="Acciones principales">
            <a class="bocc-button bocc-button--primary" href="#bocc-menu-app">Ver el menú interactivo</a>
            <a class="bocc-button bocc-button--ghost" href="/reservaciones/?hero=a">Reservar mesa</a>
          </div>
        </div>
        <div class="bocc-hero__signature" aria-label="Concepto de la propuesta">
          <span>Propuesta A</span>
          <strong>Editorial nocturna</strong>
        </div>
      </div>`;
  } else {
    hero.innerHTML = `
      <div class="bocc-hero-b__grid">
        <div class="bocc-hero-b__copy">
          <p class="bocc-hero__context">Bar de copas · Cocina · Eventos</p>
          <h1 id="bocc-hero-b-title">Nos vemos en Boccantina.</h1>
          <p class="bocc-hero__intro">Un punto de encuentro en Belén para compartir la mesa, brindar y dejar que la noche marque el ritmo.</p>
          <div class="bocc-hero__actions" aria-label="Acciones principales">
            <a class="bocc-button bocc-button--gold" href="/reservaciones/">Reservar mesa</a>
            <a class="bocc-button bocc-button--line" href="#menu">Explorar el menú</a>
          </div>
          <p class="bocc-hero-b__variant">Propuesta B · Composición arquitectónica</p>
        </div>
        <div class="bocc-hero-b__visual" aria-label="Ambiente y propuesta gastronómica de Boccantina">
          <img class="bocc-hero-b__main" src="/wp-content/uploads/2026/05/AERIAL-BCC.webp" alt="Vista superior del salón de Boccantina" width="1600" height="2000">
          <figure class="bocc-hero-b__detail bocc-hero-b__detail--drink">
            <img src="/wp-content/uploads/revslider/mood-board-infinite-filmstrip-media-gallery/DRINK-2.webp" alt="Cóctel servido con hielo personalizado de Boccantina" width="350" height="350">
          </figure>
          <figure class="bocc-hero-b__detail bocc-hero-b__detail--food">
            <img src="/wp-content/uploads/revslider/mood-board-infinite-filmstrip-media-gallery/FOOD-2.webp" alt="Hamburguesa de la propuesta gastronómica de Boccantina" width="350" height="350">
          </figure>
        </div>
      </div>`;
  }

  page.prepend(hero);
})();
