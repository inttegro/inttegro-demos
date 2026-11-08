(function initDemoUI() {
  const iconClose = '<svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

  for (const dialog of document.querySelectorAll('[data-cart-dialog]')) {
    if (dialog.dataset.demoUiEnhanced === 'true') continue;
    dialog.dataset.demoUiEnhanced = 'true';
    const open = () => {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    };

    for (const trigger of document.querySelectorAll('[data-cart-open]')) {
      trigger.addEventListener('click', open);
    }

    const close = dialog.querySelector('[data-cart-close]');
    if (close) {
      close.innerHTML = iconClose;
      close.addEventListener('click', () => dialog.close());
    }

    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });

    if (dialog.hasAttribute('data-auto-open')) open();
  }

  for (const swatch of document.querySelectorAll('[data-swatch]')) {
    if (swatch.dataset.demoUiEnhanced === 'true') continue;
    swatch.dataset.demoUiEnhanced = 'true';
    swatch.addEventListener('click', () => {
      for (const peer of swatch.parentElement.querySelectorAll('[data-swatch]')) {
        peer.setAttribute('aria-pressed', String(peer === swatch));
      }
      for (const label of document.querySelectorAll('[data-finish-label]')) {
        label.textContent = swatch.getAttribute('aria-label') || '';
        label.setAttribute('aria-live', 'polite');
      }
      for (const form of document.querySelectorAll('[data-checkout-form]')) {
        let finish = form.querySelector('input[name="finish"]');
        if (!(finish instanceof HTMLInputElement)) {
          finish = document.createElement('input');
          finish.type = 'hidden';
          finish.name = 'finish';
          form.append(finish);
        }
        finish.value = swatch.getAttribute('aria-label') || '';
      }
    });
  }

  for (const button of document.querySelectorAll('[data-copy-invoice]')) {
    if (button.dataset.demoUiEnhanced === 'true') continue;
    button.dataset.demoUiEnhanced = 'true';
    button.addEventListener('click', async () => {
      await navigator.clipboard?.writeText('INV-2048');
      const previous = button.textContent;
      button.textContent = 'Copied';
      window.setTimeout(() => { button.textContent = previous; }, 1600);
    });
  }

  const story = document.querySelector('.story-kora, .story-event, .story-ledger, .campaign-shell');
  if (story && !document.querySelector('.result-page') && !document.querySelector('[data-mobile-action-dock]')) {
    const dock = document.createElement('div');
    dock.className = 'mobile-action-dock';
    dock.dataset.mobileActionDock = '';

    let label = 'Continue';
    let detail = '';
    let target = '#top';
    if (story.matches('.story-kora')) {
      label = 'Add to bag';
      detail = 'GHS 50';
      target = 'cart';
    } else if (story.matches('.story-event')) {
      label = 'Reserve ticket';
      detail = 'GHS 50';
      target = '#tickets';
    } else if (story.matches('.story-ledger')) {
      label = 'Pay invoice';
      detail = 'GHS 50';
      target = '#payment';
    } else if (story.matches('.campaign-shell')) {
      label = 'Back this garden';
      detail = 'from GHS 50';
      target = '#support';
    }

    dock.innerHTML = `<button type="button"><span><strong>${label}</strong><small>${detail}</small></span><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7 4 6 6-6 6"/></svg></button>`;
    const action = dock.querySelector('button');
    dock.setAttribute('aria-hidden', 'true');
    if (action) action.disabled = true;
    action?.addEventListener('click', () => {
      if (target === 'cart') {
        document.querySelector('[data-cart-open]')?.click();
        return;
      }
      document.querySelector(target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    document.body.append(dock);

    const source = story.matches('.story-kora')
      ? document.querySelector('.kora-hero-actions')
      : story.matches('.story-event')
        ? document.querySelector('.event-header .header-action')
        : story.matches('.campaign-shell')
          ? document.querySelector('.nav-action')
          : null;
    const setDockVisibility = (visible) => {
      dock.classList.toggle('is-visible', visible);
      dock.setAttribute('aria-hidden', String(!visible));
      if (action) action.disabled = !visible;
    };
    if (source && 'IntersectionObserver' in window) {
      const dockObserver = new IntersectionObserver(([entry]) => setDockVisibility(!entry.isIntersecting), { threshold: 0.1 });
      dockObserver.observe(source);
    } else {
      const updateDockForScroll = () => setDockVisibility(window.scrollY > 220);
      window.addEventListener('scroll', updateDockForScroll, { passive: true });
      updateDockForScroll();
    }

    if (story.matches('.campaign-shell')) {
      const contributionLabel = document.querySelector('[data-contribution-form] button[type="submit"] span');
      if (contributionLabel) {
        const syncLabel = () => {
          const value = contributionLabel.textContent?.replace(/^(Contribute|Give)\s+/, '') || 'from GHS 50';
          const detailNode = dock.querySelector('small');
          if (detailNode) detailNode.textContent = value;
        };
        new MutationObserver(syncLabel).observe(contributionLabel, { childList: true, characterData: true, subtree: true });
        syncLabel();
      }
    }
  }

  const observedLinks = [...document.querySelectorAll('nav a[href^="#"]')];
  const observedSections = observedLinks
    .map((link) => document.querySelector(link.getAttribute('href')))
    .filter(Boolean);
  if ('IntersectionObserver' in window && observedSections.length) {
    const navigationObserver = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible?.target.id) return;
      for (const link of observedLinks) {
        if (link.getAttribute('href') === `#${visible.target.id}`) link.setAttribute('aria-current', 'location');
        else if (link.hasAttribute('aria-current')) link.removeAttribute('aria-current');
      }
    }, { rootMargin: '-18% 0px -64%', threshold: [0.05, 0.35, 0.65] });
    observedSections.forEach((section) => navigationObserver.observe(section));
  }
})();
