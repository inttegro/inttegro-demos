import { createContainerClass, createContainerWorker } from "../../hosting/container-runtime.js";

export const AppContainer = createContainerClass({ port: 3014 });
export default createContainerWorker("APP_CONTAINER");
