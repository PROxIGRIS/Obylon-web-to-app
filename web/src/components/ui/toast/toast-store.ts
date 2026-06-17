import { useState, useEffect } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'custom';
export type ToastPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  id?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  type?: ToastType;
  duration?: number;
  action?: ToastAction;
  cancel?: ToastAction;
  icon?: React.ReactNode;
  persistent?: boolean;
}

export interface Toast extends ToastOptions {
  id: string;
  type: ToastType;
  visible: boolean;
  createdAt: number;
}

type ToastState = {
  toasts: Toast[];
};

let memoryState: ToastState = { toasts: [] };
let listeners: Array<(state: ToastState) => void> = [];

const MAX_TOASTS = 5;

const dispatch = (state: ToastState) => {
  memoryState = state;
  listeners.forEach((listener) => listener(memoryState));
};

const genId = () => Math.random().toString(36).substring(2, 9);

export const notify = {
  custom: (options: ToastOptions) => {
    const id = options.id || genId();
    const newToast: Toast = {
      ...options,
      id,
      type: options.type || 'custom',
      visible: true,
      createdAt: Date.now(),
    };

    dispatch({
      toasts: [newToast, ...memoryState.toasts].slice(0, MAX_TOASTS),
    });

    return id;
  },
  success: (options: Omit<ToastOptions, 'type'> | string, extraOpts?: Omit<ToastOptions, 'title' | 'type'>) => {
    return notify.custom(
      typeof options === 'string'
        ? { title: options, type: 'success', ...extraOpts }
        : { ...options, type: 'success' }
    );
  },
  error: (options: Omit<ToastOptions, 'type'> | string, extraOpts?: Omit<ToastOptions, 'title' | 'type'>) => {
    return notify.custom(
      typeof options === 'string'
        ? { title: options, type: 'error', ...extraOpts }
        : { ...options, type: 'error' }
    );
  },
  warning: (options: Omit<ToastOptions, 'type'> | string, extraOpts?: Omit<ToastOptions, 'title' | 'type'>) => {
    return notify.custom(
      typeof options === 'string'
        ? { title: options, type: 'warning', ...extraOpts }
        : { ...options, type: 'warning' }
    );
  },
  info: (options: Omit<ToastOptions, 'type'> | string, extraOpts?: Omit<ToastOptions, 'title' | 'type'>) => {
    return notify.custom(
      typeof options === 'string'
        ? { title: options, type: 'info', ...extraOpts }
        : { ...options, type: 'info' }
    );
  },
  promise: <T>(
    promise: Promise<T>,
    msgs: {
      loading: string | React.ReactNode;
      success: string | ((data: T) => React.ReactNode);
      error: string | ((error: any) => React.ReactNode);
    }
  ) => {
    const id = notify.custom({ title: msgs.loading, type: 'info', persistent: true });
    promise
      .then((p) => {
        notify.update(id, {
          title: typeof msgs.success === 'function' ? msgs.success(p) : msgs.success,
          type: 'success',
          persistent: false,
        });
        return p;
      })
      .catch((e) => {
        notify.update(id, {
          title: typeof msgs.error === 'function' ? msgs.error(e) : msgs.error,
          type: 'error',
          persistent: false,
        });
      });
    return promise;
  },
  dismiss: (id?: string) => {
    if (!id) {
      dispatch({ toasts: [] });
      return;
    }
    dispatch({
      toasts: memoryState.toasts.filter((t) => t.id !== id),
    });
  },
  update: (id: string, options: Partial<ToastOptions>) => {
    dispatch({
      toasts: memoryState.toasts.map((t) => (t.id === id ? { ...t, ...options } : t)),
    });
  },
};

export function useToastStore() {
  const [state, setState] = useState<ToastState>(memoryState);

  useEffect(() => {
    listeners.push(setState);
    return () => {
      listeners = listeners.filter((l) => l !== setState);
    };
  }, []);

  return state;
}
