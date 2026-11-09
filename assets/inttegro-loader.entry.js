/**
 * Audited public loader aligned with @inttegro/js v0.7.2.
 *
 * This file contains only the controlled-origin loader. The executable
 * Checkout runtime remains private and is downloaded only from Inttegro's
 * fixed origin.
 * Source: https://github.com/inttegro/js/blob/v0.7.2/packages/js/src/loader.ts
 */
const INTTEGRO_JS_VERSION = "0.7.2";
export const INTTEGRO_JS_URL =
  "https://js.inttegro.com/inttegro.js@0.7.2";

const LOAD_TIMEOUT_MS = 15_000;
const SCRIPT_MARKER = "data-inttegro-js";
let loadPromise;

export class InttegroCheckoutError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "InttegroCheckoutError";
    this.code = code;
  }
}

export function loadInttegro(options = {}) {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.resolve(null);
  }

  loadPromise ??= loadRuntime(options).catch((error) => {
    loadPromise = undefined;
    throw error;
  });
  return loadPromise;
}

async function loadRuntime(options) {
  const existingScript = findRuntimeScript();
  if (existingScript) {
    const runtime = readRuntime();
    if (runtime) return runtime;
    return waitForRuntime(existingScript, false);
  }

  if (readWindowRuntime()) {
    throw new InttegroCheckoutError(
      "invalid_runtime",
      `Inttegro was initialized without the required ${INTTEGRO_JS_URL} script.`,
    );
  }

  const script = document.createElement("script");
  script.async = true;
  script.crossOrigin = "anonymous";
  script.referrerPolicy = "origin";
  script.src = INTTEGRO_JS_URL;
  script.setAttribute(SCRIPT_MARKER, INTTEGRO_JS_VERSION);
  if (options.nonce) script.nonce = options.nonce;

  const runtime = waitForRuntime(script, true);
  document.head.append(script);
  return runtime;
}

function waitForRuntime(script, removeOnFailure) {
  return new Promise((resolve, reject) => {
    let timeout;

    const cleanup = () => {
      window.clearTimeout(timeout);
      script.removeEventListener("load", handleLoad);
      script.removeEventListener("error", handleError);
    };
    const handleLoad = () => {
      cleanup();
      try {
        resolve(requireRuntime());
      } catch (error) {
        if (removeOnFailure) script.remove();
        reject(error);
      }
    };
    const handleError = () => {
      cleanup();
      if (removeOnFailure) script.remove();
      reject(
        new InttegroCheckoutError(
          "runtime_load_failed",
          `Could not load the Inttegro-hosted JavaScript runtime from ${INTTEGRO_JS_URL}.`,
        ),
      );
    };

    timeout = window.setTimeout(() => {
      cleanup();
      if (removeOnFailure) script.remove();
      reject(
        new InttegroCheckoutError(
          "runtime_load_timeout",
          "The Inttegro-hosted JavaScript runtime did not load in time.",
        ),
      );
    }, LOAD_TIMEOUT_MS);

    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", handleError, { once: true });
  });
}

function findRuntimeScript() {
  return [...document.scripts].find(
    (script) => script.src === INTTEGRO_JS_URL,
  );
}

function requireRuntime() {
  const runtime = readRuntime();
  if (runtime) return runtime;
  throw new InttegroCheckoutError(
    "invalid_runtime",
    "The Inttegro-hosted script loaded without a compatible runtime.",
  );
}

function readRuntime() {
  if (!findRuntimeScript()) return undefined;
  const runtime = readWindowRuntime();
  if (
    !runtime ||
    runtime.protocolVersion !== 1 ||
    runtime.version !== INTTEGRO_JS_VERSION ||
    typeof runtime.createCheckout !== "function"
  ) {
    return undefined;
  }
  return runtime;
}

function readWindowRuntime() {
  return window.Inttegro;
}
