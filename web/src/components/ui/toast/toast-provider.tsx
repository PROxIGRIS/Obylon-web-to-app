import React, { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useToastStore, ToastPosition } from './toast-store';
import { ToastCard } from './toast-card';

interface ToastProviderProps {
  position?: ToastPosition;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ position = 'bottom-right' }) => {
  const { toasts } = useToastStore();
  const [isPaused, setIsPaused] = useState(false);

  // Pause on window blur
  useEffect(() => {
    const handleFocus = () => setIsPaused(false);
    const handleBlur = () => setIsPaused(true);
    
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  const isTop = position.includes('top');
  const isLeft = position.includes('left');
  const isRight = position.includes('right');

  const alignClass = isLeft ? 'left-4 items-start' : isRight ? 'right-4 items-end' : 'left-1/2 -translate-x-1/2 items-center';
  const verticalClass = isTop ? 'top-4' : 'bottom-4';

  return (
    <ul
      className={`fixed z-[9999] pointer-events-none flex flex-col ${alignClass} ${verticalClass}`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
    >
      <AnimatePresence>
        {toasts.map((toast, index) => (
          <ToastCard
            key={toast.id}
            toast={toast}
            index={index}
            total={toasts.length}
            position={position}
            isPaused={isPaused}
          />
        ))}
      </AnimatePresence>
    </ul>
  );
};
