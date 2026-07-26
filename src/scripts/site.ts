/**
 * The site's entire client-side runtime. Two jobs only: submit the quote form
 * and ping call-clicks. Anything beyond this costs Lighthouse points for
 * nothing: every other interaction on the site is a link.
 */

const PHONE_MIN_DIGITS = 10;

function digits(value: string): string {
  return value.replace(/\D/g, '');
}

/* ------------------------------- Quote form ------------------------------- */

function initForms(): void {
  const forms = document.querySelectorAll<HTMLFormElement>('[data-quote-form]');

  forms.forEach((form) => {
    // Context fields the markup can't know at build time (static site, one HTML
    // for all visitors): filled in per-visit so D1 records where a lead came from.
    const pageField = form.querySelector<HTMLInputElement>('[data-page-path]');
    if (pageField) pageField.value = location.pathname;

    const utmField = form.querySelector<HTMLInputElement>('[data-utm]');
    if (utmField) utmField.value = location.search.slice(0, 300);

    const startedField = form.querySelector<HTMLInputElement>('[data-started-at]');
    if (startedField) startedField.value = String(Date.now());

    const errorBox = form.querySelector<HTMLElement>('[data-form-error]');
    const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');

    const showError = (message: string) => {
      if (!errorBox) return;
      errorBox.textContent = message;
      errorBox.hidden = false;
    };

    const clearError = () => {
      if (errorBox) errorBox.hidden = true;
    };

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearError();

      const name = form.querySelector<HTMLInputElement>('[name="name"]');
      const phone = form.querySelector<HTMLInputElement>('[name="phone"]');

      // Validate before the round trip so a typo costs zero latency.
      const invalid: HTMLInputElement[] = [];
      if (name && !name.value.trim()) invalid.push(name);
      if (phone && digits(phone.value).length < PHONE_MIN_DIGITS) invalid.push(phone);

      [name, phone].forEach((field) => {
        if (field) field.removeAttribute('aria-invalid');
      });

      if (invalid.length) {
        invalid.forEach((field) => field.setAttribute('aria-invalid', 'true'));
        invalid[0].focus();
        showError('Please add your name and a phone number we can reach you at.');
        return;
      }

      if (submit) {
        submit.disabled = true;
        submit.textContent = 'Sending…';
      }

      try {
        const response = await fetch(form.action, {
          method: 'POST',
          headers: { Accept: 'application/json' },
          body: new FormData(form),
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        location.assign('/thanks/');
      } catch {
        // Never strand a lead on a failed fetch: hand them the phone number.
        showError(
          'Something went wrong sending that. Please call us instead so your message does not get lost.',
        );
        if (submit) {
          submit.disabled = false;
          submit.textContent = 'Request my free quote';
        }
      }
    });
  });
}

/* ----------------------------- Call-click ping ---------------------------- */

function initCallTracking(): void {
  document.querySelectorAll<HTMLAnchorElement>('[data-call-cta]').forEach((link) => {
    link.addEventListener('click', () => {
      const payload = JSON.stringify({
        placement: link.dataset.placement ?? 'unknown',
        page: location.pathname,
        utm: location.search.slice(0, 300),
      });

      // sendBeacon survives the tel: handoff; fetch usually doesn't.
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/call-click', new Blob([payload], { type: 'application/json' }));
      }
    });
  });
}

initForms();
initCallTracking();
