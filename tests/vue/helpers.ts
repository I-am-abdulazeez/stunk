import { createApp, type App } from "vue";

/**
 * Runs a composable inside a real component `setup()` so lifecycle hooks
 * (onScopeDispose etc.) behave exactly as they do in an app.
 */
export function withSetup<T>(composable: () => T): { result: T; app: App; unmount: () => void } {
  let result!: T;

  const app = createApp({
    setup() {
      result = composable();
      return () => null;
    },
  });

  app.mount(document.createElement("div"));

  return { result, app, unmount: () => app.unmount() };
}

export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
