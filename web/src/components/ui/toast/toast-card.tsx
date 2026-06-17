import React, { useEffect } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { Toast, notify } from './toast-store';
import { X, CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-react';

interface ToastCardProps {
  toast: Toast;
  index: number;
  total: number;
  position: 'bottom-right' | 'top-right' | 'bottom-center' | 'top-center' | 'bottom-left' | 'top-left';
  isPaused: boolean;
}

const SWIPE_THRESHOLD = 50;

export const ToastCard: React.FC<ToastCardProps> = ({ toast, index, total, position, isPaused }) => {
  const isTop = position.includes('top');
  const isCenter = position.includes('center');
  
  // Auto dismiss logic
  useEffect(() => {
    if (toast.persistent || isPaused) return;
    const duration = toast.duration || 4000;
    
    const timeoutId = setTimeout(() => notify.dismiss(toast.id), duration);
    return () => clearTimeout(timeoutId);
  }, [toast.persistent, toast.duration, toast.id, isPaused]);

  // Drag to dismiss
  const dragX = useMotionValue(0);
  const dragY = useMotionValue(0);
  
  const opacity = useTransform(isCenter ? dragY : dragX, [-100, 0, 100], [0, 1, 0]);

  const handleDragEnd = (e: any, info: any) => {
    const offset = isCenter ? info.offset.y : info.offset.x;
    if (Math.abs(offset) > SWIPE_THRESHOLD) {
      notify.dismiss(toast.id);
    } else {
      animate(isCenter ? dragY : dragX, 0, { type: 'spring', stiffness: 400, damping: 25 });
    }
  };

  // Stack calculation
  const offset = index * 16; // visual stacking gap
  const scale = 1 - index * 0.05;
  const y = isTop ? offset : -offset;

  let borderColor = 'var(--border)';
  let bgClass = 'bg-[oklch(0.992_0.008_92)]';
  let Icon = Info;
  let titleColor = 'text-[oklch(0.27_0.005_270)]';
  let headerPrefix = 'SYSTEM NOTICE';

  if (toast.type === 'success') {
    borderColor = 'var(--sage)';
    Icon = CheckCircle;
    headerPrefix = 'OPERATION COMPLETE';
  } else if (toast.type === 'error') {
    borderColor = 'var(--blood)';
    Icon = AlertTriangle;
    headerPrefix = 'SYSTEM ALERT';
  } else if (toast.type === 'warning') {
    borderColor = 'var(--amber)';
    Icon = AlertCircle;
    headerPrefix = 'WARNING';
  }

  const yOrigin = isTop ? 'top-0' : 'bottom-0';
  const xOrigin = position.includes('left') ? 'left-0' : position.includes('right') ? 'right-0' : 'left-1/2 -ml-[175px]';

  return (
    <motion.li
      initial={{ opacity: 0, y: isTop ? -50 : 50, scale: 0.8 }}
      animate={{ opacity: 1, y, scale }}
      exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      style={{ 
        x: isCenter ? 0 : dragX, 
        y: isCenter ? dragY : y, 
        opacity,
        zIndex: total - index
      }}
      drag={isCenter ? 'y' : 'x'}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      onDragEnd={handleDragEnd}
      className={`absolute w-[350px] pointer-events-auto rounded-2xl px-4 py-4 shadow-[0_2px_8px_-2px_oklch(0.27_0.005_270_/_0.12),0_16px_32px_-8px_oklch(0.27_0.005_270_/_0.10)] border border-[oklch(0.27_0.005_270_/_0.10)] border-l-[3px] overflow-hidden ${bgClass} ${yOrigin} ${xOrigin}`}
      style={{ borderLeftColor: borderColor }}
      role="status"
      aria-live="polite"
      tabIndex={0}
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5">
          {toast.icon || <Icon className="w-4 h-4" style={{ color: borderColor }} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-mono text-[9px] uppercase tracking-widest text-[oklch(0.45_0.008_270)] mb-1">
            {headerPrefix}
          </div>
          <h3 className={`text-sm font-semibold leading-snug ${titleColor}`}>
            {toast.title}
          </h3>
          {toast.description && (
            <p className="text-xs leading-relaxed mt-1 text-[oklch(0.45_0.008_270)]">
              {toast.description}
            </p>
          )}
          {(toast.action || toast.cancel) && (
            <div className="mt-3 flex items-center gap-2">
              {toast.action && (
                <button 
                  onClick={() => { toast.action?.onClick(); notify.dismiss(toast.id); }}
                  className="rounded-full px-3 py-1 text-[11px] font-medium bg-[oklch(0.27_0.005_270)] text-[oklch(0.985_0.012_92)] hover:opacity-90 transition-opacity"
                >
                  {toast.action.label}
                </button>
              )}
              {toast.cancel && (
                <button 
                  onClick={() => { toast.cancel?.onClick(); notify.dismiss(toast.id); }}
                  className="rounded-full px-3 py-1 text-[11px] font-medium bg-[oklch(0.94_0.012_92)] text-[oklch(0.45_0.008_270)] hover:bg-[oklch(0.90_0.012_92)] transition-colors"
                >
                  {toast.cancel.label}
                </button>
              )}
            </div>
          )}
        </div>
        <button 
          onClick={() => notify.dismiss(toast.id)}
          className="shrink-0 p-1 -mr-2 -mt-2 rounded-full text-[oklch(0.45_0.008_270)] hover:bg-[oklch(0.94_0.012_92)] transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[oklch(0.27_0.005_270)]"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </motion.li>
  );
};
