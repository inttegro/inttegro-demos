import { createContainerClass, createContainerWorker } from "../../hosting/container-runtime.js";

export const AppContainer = createContainerClass({
  port: 3006,
  readinessHeaders: { "x-forwarded-proto": "https" },
});
export default createContainerWorker("APP_CONTAINER");
