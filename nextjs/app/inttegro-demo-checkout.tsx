'use client';

import {
  Checkout,
  type CheckoutEvent,
  type CheckoutHandle,
  type CheckoutProps,
} from '@inttegro/react';
import { createRoot } from 'react-dom/client';
import { useEffect } from 'react';

type AdapterOptions = Pick<
  CheckoutProps,
  'appearance' | 'features' | 'locale' | 'timeout' | 'title'
> & { orderId: string };

type AdapterController = {
  ready: Promise<void>;
  destroy(): void;
  focus(): void;
};

declare global {
  interface Window {
    InttegroDemoCheckoutAdapter?: {
      packageName: '@inttegro/react';
      mount(input: {
        target: HTMLElement;
        options: AdapterOptions;
        onEvent(event: CheckoutEvent): void;
      }): AdapterController;
    };
  }
}

function createAdapter(): NonNullable<Window['InttegroDemoCheckoutAdapter']> {
  return {
    packageName: '@inttegro/react',
    mount({ target, options, onEvent }) {
      const root = createRoot(target);
      let checkout: CheckoutHandle | null = null;
      let settled = false;
      let resolveReady!: () => void;
      let rejectReady!: (error: Error) => void;
      const ready = new Promise<void>((resolve, reject) => {
        resolveReady = resolve;
        rejectReady = reject;
      });

      root.render(
        <Checkout
          {...options}
          ref={(handle) => {
            checkout = handle;
          }}
          onEvent={(event) => {
            onEvent(event);
            if (event.type === 'ready' && !settled) {
              settled = true;
              resolveReady();
            }
          }}
          onError={(error) => {
            if (settled) return;
            settled = true;
            rejectReady(error);
          }}
        />,
      );

      return {
        ready,
        destroy() {
          if (!settled) {
            settled = true;
            rejectReady(new Error('Checkout closed before it became ready.'));
          }
          root.unmount();
        },
        focus() {
          checkout?.focus();
        },
      };
    },
  };
}

export function InttegroDemoCheckoutAdapter() {
  useEffect(() => {
    const previous = window.InttegroDemoCheckoutAdapter;
    const adapter = createAdapter();
    window.InttegroDemoCheckoutAdapter = adapter;
    return () => {
      if (window.InttegroDemoCheckoutAdapter === adapter) {
        window.InttegroDemoCheckoutAdapter = previous;
      }
    };
  }, []);

  return null;
}
