import { CommonModule } from '@angular/common'
import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  type AfterViewInit,
} from '@angular/core'
import {
  CheckoutComponent,
  type CheckoutErrorEvent,
} from '@inttegro/angular'
import { loadInttegro } from '@inttegro/js'

type CheckoutPresentation = 'embedded' | 'modal'

/**
 * INTTEGRO:FLOW [checkout-presentation]
 *
 * FastAPI renders the event and the ordinary reservation form. This standalone
 * Angular component owns only the payment presentation boundary: it requests a
 * finalized Order ID from FastAPI, then passes that client-safe reference to
 * Inttegro's Angular Checkout component. The Python API key, Product, Price,
 * and order-construction authority stay on the server.
 *
 * The hybrid boundary is intentional. Hosted page remains an ordinary form
 * POST and 303 redirect—even without JavaScript—while embedded and modal modes
 * get Angular inputs, outputs, and teardown semantics.
 *
 * INTTEGRO:DOCS https://studio.inttegro.com/web/angular
 * INTTEGRO:DOCS https://studio.inttegro.com/accept-payment-with-inttegro-checkout
 */
@Component({
  selector: 'inttegro-demo-checkout',
  standalone: true,
  imports: [CommonModule, CheckoutComponent],
  template: `
    @if (orderId && presentation === 'embedded') {
      <section
        class="inttegro-checkout-surface inttegro-checkout-inline"
        data-inttegro-angular-surface
      >
        <inttegro-checkout
          [appearance]="{ theme: 'light' }"
          [features]="features"
          locale="en-GH"
          [orderId]="orderId"
          title="Complete your Afterglow reservation"
          (completed)="handleCompleted()"
          (error)="handleCheckoutError($event)"
          (ready)="handleReady()"
        />
        <p
          class="checkout-presentation-feedback"
          [attr.data-kind]="surfaceMessageKind"
          aria-live="polite"
          [hidden]="!surfaceMessage"
        >{{ surfaceMessage }}</p>
      </section>
    } @else if (orderId && presentation === 'modal') {
      <dialog
        #modalDialog
        class="framework-checkout-dialog"
        aria-label="Complete your Afterglow reservation"
        (close)="handleCanceled()"
        (click)="handleDialogClick($event)"
      >
        <button
          class="framework-checkout-dialog-close"
          type="button"
          aria-label="Close payment window"
          (click)="modalDialog.close()"
        ><span aria-hidden="true">×</span></button>
        <inttegro-checkout
          #modalCheckout
          [appearance]="{ theme: 'light' }"
          [features]="features"
          locale="en-GH"
          [orderId]="orderId"
          title="Complete your Afterglow reservation"
          (completed)="handleCompleted()"
          (error)="handleCheckoutError($event)"
          (ready)="handleReady()"
        />
      </dialog>
    }
  `,
  styles: [':host { display: contents; }'],
})
export class CheckoutFlowComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly features = {
    showLineItems: true,
    showInvoiceDownload: true,
    showReceiptDownload: true,
    allowPaymentMethodChange: true,
  }

  orderId = ''
  presentation: CheckoutPresentation = 'embedded'
  surfaceMessage = ''
  surfaceMessageKind: 'status' | 'error' = 'status'

  @ViewChild('modalDialog') private modalDialog?: ElementRef<HTMLDialogElement>
  @ViewChild('modalCheckout', { read: ElementRef })
  private modalCheckout?: ElementRef<HTMLElement>

  private form?: HTMLFormElement

  constructor(private readonly changeDetector: ChangeDetectorRef) {}

  private readonly submit = (event: SubmitEvent) => {
    if (!this.form) return
    const selected = String(new FormData(this.form).get('checkout_mode') || 'hosted')
    if (selected === 'hosted') {
      this.setFormBusy(true, 'Opening Inttegro Pages…')
      return
    }
    event.preventDefault()
    void this.startCheckout(selected === 'modal' ? 'modal' : 'embedded')
  }

  private readonly restoreAfterHistoryNavigation = () => this.setFormBusy(false, '')

  ngOnInit(): void {
    const candidate = document.querySelector('[data-checkout-form]')
    if (candidate instanceof HTMLFormElement) this.form = candidate
  }

  ngAfterViewInit(): void {
    this.form?.addEventListener('submit', this.submit)
    window.addEventListener('pageshow', this.restoreAfterHistoryNavigation)
  }

  ngOnDestroy(): void {
    this.form?.removeEventListener('submit', this.submit)
    window.removeEventListener('pageshow', this.restoreAfterHistoryNavigation)
  }

  private async startCheckout(nextPresentation: CheckoutPresentation): Promise<void> {
    if (!this.form) return
    this.presentation = nextPresentation
    this.orderId = ''
    this.surfaceMessage = ''
    this.changeDetector.detectChanges()
    this.setFormBusy(
      true,
      nextPresentation === 'modal' ? 'Preparing payment window…' : 'Preparing checkout…',
    )
    this.setFormFeedback('Creating a finalized order securely on the server…')

    try {
      // INTTEGRO:DECISION [hosted-runtime-loader] Check the fixed-origin hosted
      // runtime before asking FastAPI to finalize an Order. The Angular adapter
      // calls the same de-duplicated loader when its component mounts.
      await loadInttegro()

      const response = await fetch(this.form.action, {
        method: 'POST',
        body: stringFormBody(this.form),
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      })
      this.orderId = await parseOrderResponse(response)
      // The submit listener belongs to the server-rendered form outside this
      // Angular component. Trigger a render explicitly after the asynchronous
      // Order response so zoneless Angular applications create the Checkout
      // component (and the application-owned dialog) immediately.
      this.changeDetector.detectChanges()
      if (nextPresentation === 'embedded') {
        this.form.hidden = true
        requestAnimationFrame(() => {
          document
            .querySelector('[data-inttegro-angular-surface]')
            ?.scrollIntoView({
              behavior: reducedMotion() ? 'auto' : 'smooth',
              block: 'nearest',
            })
        })
      } else {
        // @inttegro/angular 0.2.0 embeds Checkout. Angular owns this accessible
        // dialog until an adapter release with managed-modal presentation is
        // available from the public registry.
        this.modalDialog?.nativeElement.showModal()
      }
      this.setFormFeedback('')
    } catch (error) {
      this.restoreForm()
      this.setFormFeedback(errorMessage(error), 'error')
    }
  }

  handleReady(): void {
    this.surfaceMessage = ''
    this.setFormFeedback('')
    this.modalCheckout?.nativeElement
      .querySelector<HTMLIFrameElement>('iframe')
      ?.focus({ preventScroll: true })
  }

  handleCompleted(): void {
    this.surfaceMessage = 'Payment completed. Verifying the order…'
    this.surfaceMessageKind = 'status'
    // INTTEGRO:VERIFY [server-side-verification] A component output can guide
    // navigation, but ticket delivery must follow an authenticated Order lookup
    // or verified webhook rather than trusting the browser.
    window.location.assign('/complete')
  }

  handleCanceled(): void {
    this.restoreForm()
    this.setFormFeedback('Payment window closed. Your reservation details are still here.')
  }

  handleDialogClick(event: MouseEvent): void {
    if (event.target === this.modalDialog?.nativeElement) {
      this.modalDialog.nativeElement.close()
    }
  }

  handleCheckoutError(error: CheckoutErrorEvent | Error): void {
    const message = errorMessage(error)
    this.surfaceMessage = message
    this.surfaceMessageKind = 'error'
    this.restoreForm()
    this.setFormFeedback(message, 'error')
  }

  private restoreForm(): void {
    this.orderId = ''
    this.changeDetector.detectChanges()
    if (this.form) this.form.hidden = false
    this.setFormBusy(false, '')
  }

  private setFormFeedback(message: string, kind: 'status' | 'error' = 'status'): void {
    const feedback = this.form?.querySelector('[data-checkout-feedback]')
    if (!(feedback instanceof HTMLElement)) return
    feedback.textContent = message
    feedback.dataset['kind'] = kind
    feedback.hidden = !message
  }

  private setFormBusy(busy: boolean, message: string): void {
    if (!this.form) return
    const button = this.form.querySelector('button[type="submit"]')
    if (button instanceof HTMLButtonElement) {
      button.disabled = busy
      button.setAttribute('aria-busy', String(busy))
      const label = button.querySelector('span')
      if (label instanceof HTMLElement) {
        if (busy && !label.dataset['checkoutOriginalContent']) {
          label.dataset['checkoutOriginalContent'] = label.innerHTML
        }
        if (busy) label.textContent = message
        else if (label.dataset['checkoutOriginalContent']) {
          label.innerHTML = label.dataset['checkoutOriginalContent']
          delete label.dataset['checkoutOriginalContent']
        }
      }
    }
    for (const input of this.form.querySelectorAll<HTMLInputElement>(
      '.checkout-presentation-picker input[type="radio"]',
    )) {
      input.disabled = busy
    }
  }
}

function stringFormBody(form: HTMLFormElement): URLSearchParams {
  const body = new URLSearchParams()
  for (const [name, value] of new FormData(form)) {
    if (typeof value === 'string') body.append(name, value)
  }
  return body
}

async function parseOrderResponse(response: Response): Promise<string> {
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('The demo server returned an unexpected response.')
  }
  const payload: unknown = await response.json()
  if (!response.ok) {
    throw new Error(
      isRecord(payload) && typeof payload['message'] === 'string'
        ? payload['message']
        : 'Checkout could not be started.',
    )
  }
  if (!isRecord(payload) || typeof payload['orderId'] !== 'string') {
    throw new Error('The demo server did not return a checkout Order ID.')
  }
  return payload['orderId']
}

function errorMessage(error: CheckoutErrorEvent | Error | unknown): string {
  if (error instanceof Error) return error.message
  if (
    isRecord(error) &&
    isRecord(error['error']) &&
    typeof error['error']['message'] === 'string'
  ) {
    return error['error']['message']
  }
  return 'Checkout could not be started.'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function reducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
