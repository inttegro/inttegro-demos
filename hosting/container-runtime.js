import { DurableObject } from "cloudflare:workers";

const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000;
const STARTUP_ATTEMPTS = 300;
const STARTUP_RETRY_MS = 200;

function runtimeEnvironment(bindings, port) {
  const environment = {};
  for (const [name, value] of Object.entries(bindings)) {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      environment[name] = String(value);
    }
  }
  environment.HOST = "0.0.0.0";
  environment.PORT = String(port);
  return environment;
}

export function createContainerClass({
  port,
  readinessPath = "/health",
  readinessHeaders = {},
}) {
  return class AppContainer extends DurableObject {
    constructor(ctx, env) {
      super(ctx, env);
      this.ctx = ctx;
      this.env = env;
      this.starting = undefined;
      this.monitoring = undefined;

      if (ctx.container?.running) {
        void ctx.blockConcurrencyWhile(() =>
          ctx.container.setInactivityTimeout(INACTIVITY_TIMEOUT_MS),
        );
        this.observeExit();
      }
    }

    async fetch(request) {
      this.starting ??= this.startAndWaitForPort().finally(() => {
        this.starting = undefined;
      });
      await this.starting;

      const url = new URL(request.url);
      url.protocol = "http:";
      url.host = "container";
      const forwarded = new Request(url, request);
      forwarded.headers.delete("host");
      forwarded.headers.set("x-forwarded-proto", "https");
      forwarded.headers.set("x-forwarded-host", request.headers.get("host") ?? url.hostname);
      return this.ctx.container.getTcpPort(port).fetch(forwarded);
    }

    async startAndWaitForPort() {
      const container = this.ctx.container;
      if (!container.running) {
        container.start({
          image: container.images.base,
          instance: "lite",
          enableInternet: true,
          env: runtimeEnvironment(this.env, port),
        });
      }

      this.observeExit();
      await container.setInactivityTimeout(INACTIVITY_TIMEOUT_MS);
      const tcpPort = container.getTcpPort(port);
      let lastError;
      for (let attempt = 0; attempt < STARTUP_ATTEMPTS; attempt += 1) {
        try {
          const response = await tcpPort.fetch(`http://container${readinessPath}`, {
            headers: readinessHeaders,
            signal: AbortSignal.timeout(1_000),
          });
          await response.body?.cancel();
          if (response.ok) return;
          lastError = new Error(`Readiness check returned ${response.status}`);
        } catch (error) {
          lastError = error;
        }
        await scheduler.wait(STARTUP_RETRY_MS);
      }
      throw new Error(`Container did not become ready on port ${port}`, { cause: lastError });
    }

    observeExit() {
      if (this.monitoring) return;
      this.monitoring = this.ctx.container
        .monitor()
        .then(() => console.log("Container exited successfully"))
        .catch((error) => console.error("Container failed", error))
        .finally(() => {
          this.monitoring = undefined;
        });
      this.ctx.waitUntil(this.monitoring);
    }
  };
}

export function createContainerWorker(bindingName) {
  return {
    fetch(request, env) {
      return env[bindingName].getByName("primary").fetch(request);
    },
  };
}
