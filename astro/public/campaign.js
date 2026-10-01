const form = document.querySelector('[data-contribution-form]');

if (form instanceof HTMLFormElement) {
  const button = form.querySelector('button[type="submit"]');
  const buttonLabel = form.querySelector('button span');
  const customAmountControl = form.querySelector('[data-custom-amount-control]');
  const customAmountInput = form.elements.namedItem('custom_amount');
  const customTierInput = form.querySelector('input[name="tier"][value="custom"]');
  const amounts = { seed: '50', grower: '100', steward: '250' };
  const validAmount = (value) => /^[0-9]+(?:[.][0-9]{1,2})?$/.test(value) && Number(value) > 0;

  const updateButton = () => {
    const selected = new FormData(form).get('tier');
    const isCustom = selected === 'custom';
    if (customAmountControl instanceof HTMLElement) {
      customAmountControl.dataset.selected = String(isCustom);
    }
    if (customAmountInput instanceof HTMLInputElement) {
      customAmountInput.required = isCustom;
    }
    const value = customAmountInput instanceof HTMLInputElement
      ? customAmountInput.value.trim()
      : '';
    const hasAmount = validAmount(value);
    if (button instanceof HTMLButtonElement) button.disabled = isCustom && !hasAmount;
    if (buttonLabel) {
      buttonLabel.textContent = hasAmount ? `Give GHS ${value}` : 'Enter an amount to continue';
    }
  };

  form.addEventListener('change', (event) => {
    const input = event.target;
    if (input instanceof HTMLInputElement && input.name === 'tier') {
      if (input.value in amounts && customAmountInput instanceof HTMLInputElement) {
        customAmountInput.value = amounts[input.value];
      }
      updateButton();
      if (input.value === 'custom' && customAmountInput instanceof HTMLInputElement) {
        customAmountInput.focus();
      }
    }
  });

  form.addEventListener('input', (event) => {
    const input = event.target;
    if (input instanceof HTMLInputElement && input.name === 'custom_amount') {
      if (customTierInput instanceof HTMLInputElement) customTierInput.checked = true;
      updateButton();
    }
  });

  window.addEventListener('pageshow', () => {
    const selected = new FormData(form).get('tier');
    if (
      selected !== 'custom'
      && selected in amounts
      && customAmountInput instanceof HTMLInputElement
    ) {
      customAmountInput.value = amounts[selected];
    }
    updateButton();
  });
}
