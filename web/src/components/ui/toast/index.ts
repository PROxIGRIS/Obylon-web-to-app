import { notify } from './toast-store';

export * from './toast-store';
export * from './toast-provider';
export * from './toast-card';

// Polyfill for Sonner's toast to avoid breaking the entire codebase
export const toast = Object.assign(
  (msg: string, opts?: any) => notify.custom({ title: msg, ...opts }),
  {
    success: notify.success,
    error: notify.error,
    warning: notify.warning,
    info: notify.info,
    custom: notify.custom,
    promise: notify.promise,
    dismiss: notify.dismiss
  }
);
