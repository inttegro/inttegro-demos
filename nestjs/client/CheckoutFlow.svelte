<script lang="ts">
  import { loadInttegro } from '@inttegro/js'
  import {
    Checkout,
    type CheckoutErrorEvent,
  } from '@inttegro/svelte'
  import { onMount, tick } from 'svelte'

  type CheckoutPresentation = 'embedded' | 'modal'

  /**
   * INTTEGRO:FLOW [checkout-presentation]
   *
   * NestJS renders the campaign and the ordinary HTML form. This Svelte island
   * owns only the payment presentation boundary: it asks NestJS for a finalized
   * Order ID, then gives that client-safe reference to the public Inttegro
   * Svelte adapter. The API key, Product, Price, quantity, and finalization
   * authority never enter this bundle.
   *
   * Keeping the form server-rendered is deliberate. With JavaScript disabled,
   * or when the visitor chooses Hosted page, the browser follows the same form
   * POST and NestJS answers with a 303 to Inttegro Pages. A fully client-rendered
   * Svelte form is also valid, but would make the resilient hosted-page path
   * depend on JavaScript.
   *
   * INTTEGRO:DOCS https://studio.inttegro.com/web/svelte
   * INTTEGRO:DOCS https://studio.inttegro.com/accept-payment-with-inttegro-checkout
   */

  let orderId = $state('')
  let presentation = $state<CheckoutPresentation>('embedded')
  let surfaceMessage = $state('')
  let surfaceMessageKind = $state<'status' | 'error'>('status')
  let form: HTMLFormElement | undefined
  let modal = $state<HTMLDialogElement>()

  onMount(() => {
    const candidate = document.querySelector('[data-contribution-form]')
    if (!(candidate instanceof HTMLFormElement)) return
    form = candidate

    const submit = (event: SubmitEvent) => {
      const selected = String(new FormData(candidate).get('checkout_mode') || 'hosted')
      if (selected === 'hosted') {
        setFormBusy(true, 'Opening Inttegro Pages…')
        return
      }
      event.preventDefault()
      void startCheckout(selected === 'modal' ? 'modal' : 'embedded')
    }
    const restoreAfterHistoryNavigation = () => setFormBusy(false, '')

    candidate.addEventListener('submit', submit)
    window.addEventListener('pageshow', restoreAfterHistoryNavigation)
    return () => {
      candidate.removeEventListener('submit', submit)
      window.removeEventListener('pageshow', restoreAfterHistoryNavigation)
    }
  })

  async function startCheckout(nextPresentation: CheckoutPresentation) {
    if (!form) return
    presentation = nextPresentation
    orderId = ''
    surfaceMessage = ''
    setFormBusy(
      true,
      nextPresentation === 'modal' ? 'Preparing payment window…' : 'Preparing checkout…',
    )
    setFormFeedback('Creating a finalized order securely on the server…')

    try {
      // INTTEGRO:DECISION [hosted-runtime-loader] Load the public adapter runtime
      // before creating an Order. If CSP, networking, or an extension blocks
      // Inttegro, the visitor can retry without leaving an unusable finalized
      // Order behind. The Svelte Checkout component performs its own load too;
      // the shared loader de-duplicates the request.
      await loadInttegro()

      const response = await fetch(form.action, {
        method: 'POST',
        body: stringFormBody(form),
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      })
      orderId = await parseOrderResponse(response)
      if (nextPresentation === 'embedded') {
        form.hidden = true
        requestAnimationFrame(() => {
          document
            .querySelector('[data-inttegro-svelte-surface]')
            ?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'nearest' })
        })
      } else {
        // @inttegro/svelte 0.2.0 embeds Checkout. The Svelte application owns
        // this accessible dialog; the forthcoming adapter-managed modal is an
        // alternative once that package version is publicly released.
        await tick()
        modal?.showModal()
      }
      setFormFeedback('')
    } catch (error) {
      restoreForm()
      setFormFeedback(errorMessage(error), 'error')
    }
  }

  function handleReady() {
    surfaceMessage = ''
    setFormFeedback('')
    modal
      ?.querySelector<HTMLIFrameElement>('iframe')
      ?.focus({ preventScroll: true })
  }

  function handleCompleted() {
    surfaceMessage = 'Payment completed. Verifying the order…'
    surfaceMessageKind = 'status'
    // INTTEGRO:VERIFY [server-side-verification] This callback is navigation,
    // not fulfillment evidence. Production code must retrieve the Order or
    // consume a verified webhook before allocating funds or issuing a receipt.
    window.location.assign('/complete')
  }

  function handleCanceled() {
    restoreForm()
    setFormFeedback('Payment window closed. Your campaign details are still here.')
  }

  function handleCheckoutError(error: CheckoutErrorEvent | Error) {
    const message = errorMessage(error)
    surfaceMessage = message
    surfaceMessageKind = 'error'
    restoreForm()
    setFormFeedback(message, 'error')
  }

  function restoreForm() {
    orderId = ''
    if (form) form.hidden = false
    setFormBusy(false, '')
  }

  function setFormFeedback(message: string, kind: 'status' | 'error' = 'status') {
    const feedback = form?.querySelector('[data-checkout-feedback]')
    if (!(feedback instanceof HTMLElement)) return
    feedback.textContent = message
    feedback.dataset.kind = kind
    feedback.hidden = !message
  }

  function setFormBusy(busy: boolean, message: string) {
    if (!form) return
    const button = form.querySelector('button[type="submit"]')
    if (button instanceof HTMLButtonElement) {
      button.disabled = busy
      button.setAttribute('aria-busy', String(busy))
      const label = button.querySelector('span')
      if (label instanceof HTMLElement) {
        if (busy && !label.dataset.checkoutOriginalContent) {
          label.dataset.checkoutOriginalContent = label.innerHTML
        }
        if (busy) label.textContent = message
        else if (label.dataset.checkoutOriginalContent) {
          label.innerHTML = label.dataset.checkoutOriginalContent
          delete label.dataset.checkoutOriginalContent
        }
      }
    }
    for (const input of form.querySelectorAll<HTMLInputElement>(
      '.checkout-presentation-picker input[type="radio"]',
    )) {
      input.disabled = busy
    }
  }

  function stringFormBody(source: HTMLFormElement) {
    const body = new URLSearchParams()
    for (const [name, value] of new FormData(source)) {
      if (typeof value === 'string') body.append(name, value)
    }
    return body
  }

  async function parseOrderResponse(response: Response) {
    if (!response.headers.get('content-type')?.includes('application/json')) {
      throw new Error('The demo server returned an unexpected response.')
    }
    const payload: unknown = await response.json()
    if (!response.ok) {
      throw new Error(
        isRecord(payload) && typeof payload.message === 'string'
          ? payload.message
          : 'Checkout could not be started.',
      )
    }
    if (!isRecord(payload) || typeof payload.orderId !== 'string') {
      throw new Error('The demo server did not return a checkout Order ID.')
    }
    return payload.orderId
  }

  function errorMessage(error: CheckoutErrorEvent | Error | unknown) {
    if (error instanceof Error) return error.message
    if (isRecord(error) && isRecord(error.error) && typeof error.error.message === 'string') {
      return error.error.message
    }
    return 'Checkout could not be started.'
  }

  function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null
  }

  function reducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }
</script>

{#if orderId && presentation === 'embedded'}
  <section
    class="inttegro-checkout-surface inttegro-checkout-inline"
    data-inttegro-svelte-surface
  >
    <Checkout
      appearance={{ theme: 'light' }}
      features={{
        showLineItems: false,
        showInvoiceDownload: true,
        showReceiptDownload: true,
        allowPaymentMethodChange: true,
      }}
      locale="en-GH"
      {orderId}
      title="Complete your Riverbend contribution"
      onCompleted={handleCompleted}
      onError={handleCheckoutError}
      onReady={handleReady}
    />
    <p
      class="checkout-presentation-feedback"
      data-kind={surfaceMessageKind}
      aria-live="polite"
      hidden={!surfaceMessage}
    >{surfaceMessage}</p>
  </section>
{:else if orderId && presentation === 'modal'}
  <dialog
    bind:this={modal}
    class="framework-checkout-dialog"
    aria-label="Complete your Riverbend contribution"
    onclose={handleCanceled}
    onclick={(event) => {
      if (event.target === modal) modal?.close()
    }}
  >
    <button
      class="framework-checkout-dialog-close"
      type="button"
      aria-label="Close payment window"
      onclick={() => modal?.close()}
    >
      <span aria-hidden="true">×</span>
    </button>
    <Checkout
      appearance={{ theme: 'light' }}
      features={{
        showLineItems: false,
        showInvoiceDownload: true,
        showReceiptDownload: true,
        allowPaymentMethodChange: true,
      }}
      locale="en-GH"
      {orderId}
      title="Complete your Riverbend contribution"
      onCompleted={handleCompleted}
      onError={handleCheckoutError}
      onReady={handleReady}
    />
  </dialog>
{/if}
