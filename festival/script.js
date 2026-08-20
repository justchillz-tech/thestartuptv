// Small progressive-enhancement layer for the festival landing page.
// The page works without JavaScript; this only adds a subtle header state.
(() => {
  const header = document.querySelector('.site-header');
  if (!header) return;

  const updateHeader = () => {
    header.classList.toggle('scrolled', window.scrollY > 20);
  };

  updateHeader();
  window.addEventListener('scroll', updateHeader, { passive: true });
})();
