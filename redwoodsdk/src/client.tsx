import { initClient, initClientNavigation } from 'rwsdk/client';
import { installInttegroDemoCheckoutAdapter } from './inttegro-demo-checkout';

installInttegroDemoCheckoutAdapter();
const { handleResponse, onHydrated } = initClientNavigation();
let presentationLoaded = false;
let demoUiLoaded = false;
initClient({
  handleResponse,
  onHydrated(meta) {
    onHydrated(meta);
    if (!demoUiLoaded) {
      demoUiLoaded = true;
      const demoUiScript = document.createElement('script');
      demoUiScript.src = '/demo-ui.js';
      document.head.appendChild(demoUiScript);
    }
    if (!presentationLoaded) {
      presentationLoaded = true;
      const presentationScript = document.createElement('script');
      presentationScript.type = 'module';
      presentationScript.src = '/checkout-presentations.js';
      document.head.appendChild(presentationScript);
    }
  },
});

const form = document.querySelector('[data-contribution-form]');
if (form instanceof HTMLFormElement) {
  const buttonLabel = form.querySelector('button span');
  const amounts: Record<string, string> = {
    seed: 'GHS 50',
    grower: 'GHS 100',
    steward: 'GHS 250',
  };
  const updateButton = () => {
    const selected = String(new FormData(form).get('tier') ?? '');
    if (buttonLabel) buttonLabel.textContent = `Contribute ${amounts[selected] ?? 'securely'}`;
  };

  form.addEventListener('change', (event) => {
    const input = event.target;
    if (input instanceof HTMLInputElement && input.name === 'tier') updateButton();
  });

  window.addEventListener('pageshow', () => {
    const button = form.querySelector('button');
    if (button instanceof HTMLButtonElement) button.disabled = false;
    updateButton();
  });
}
