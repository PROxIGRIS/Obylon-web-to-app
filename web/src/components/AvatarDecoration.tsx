import React from "react";

export type AvatarDecorationStyle =
  | "none"
  | "golden-ring"
  | "sakura-petals"
  | "lightning-arc"
  | "void-aura"
  | "matrix-rain"
  | "cyber-glitch"
  | "frost-crystal"
  | "phoenix-flame"
  | "neon-pulse"
  | "shadow-tendrils";

interface AvatarDecorationProps {
  style: AvatarDecorationStyle;
  size?: number;
  children: React.ReactNode;
  className?: string;
}

export function AvatarDecoration({ style, size = 40, children, className = "" }: AvatarDecorationProps) {
  if (style === "none") return <div className={className}>{children}</div>;
  const ringSize = size + 12;
  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: ringSize, height: ringSize }}>
      <DecorationLayer style={style} size={ringSize} />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

function DecorationLayer({ style, size }: { style: AvatarDecorationStyle; size: number }) {
  const center = size / 2;
  
  switch (style) {
    case "golden-ring":
      return (
        <svg className="absolute inset-0 pointer-events-none" width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible' }}>
          <defs>
            <filter id="gold-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <linearGradient id="gold-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FDE047" />
              <stop offset="25%" stopColor="#EAB308" />
              <stop offset="50%" stopColor="#A16207" />
              <stop offset="75%" stopColor="#EAB308" />
              <stop offset="100%" stopColor="#FDE047" />
            </linearGradient>
          </defs>
          <g className="avatar-aura-spin-fast" style={{ transformOrigin: `${center}px ${center}px` }}>
            <circle cx={center} cy={center} r={center - 3} fill="none" stroke="url(#gold-grad)" strokeWidth="3" filter="url(#gold-glow)" opacity="0.8" />
            <circle cx={center} cy={center - (center - 3)} r={2} fill="#FEF08A" filter="url(#gold-glow)" />
            <circle cx={center + (center - 3) * 0.866} cy={center + (center - 3) * 0.5} r={2} fill="#FDE047" filter="url(#gold-glow)" />
            <circle cx={center - (center - 3) * 0.866} cy={center + (center - 3) * 0.5} r={2} fill="#FEF08A" filter="url(#gold-glow)" />
          </g>
          <circle className="avatar-aura-pulse" cx={center} cy={center} r={center - 3} fill="none" stroke="#FEF08A" strokeWidth="0.5" opacity="0.5" filter="url(#gold-glow)" />
        </svg>
      );
    case "sakura-petals":
      return (
        <svg className="absolute inset-0 pointer-events-none" width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible' }}>
          <defs>
            <filter id="sakura-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          <g className="avatar-aura-spin-slow-reverse" style={{ transformOrigin: `${center}px ${center}px` }}>
            {[0, 60, 120, 180, 240, 300].map((deg, i) => (
              <g key={i} transform={`rotate(${deg} ${center} ${center}) translate(0, 3)`}>
                <path d={`M${center},${center - size/2 + 2} C${center+3},${center - size/2 - 2} ${center+5},${center - size/2 + 5} ${center},${center - size/2 + 8} C${center-5},${center - size/2 + 5} ${center-3},${center - size/2 - 2} ${center},${center - size/2 + 2}Z`} fill="#F9A8D4" filter="url(#sakura-glow)" opacity={0.7 + (i%2)*0.2} />
              </g>
            ))}
          </g>
          <circle cx={center} cy={center} r={center - 3} fill="none" stroke="#FBCFE8" strokeWidth="1" strokeDasharray="4 6" opacity="0.4" className="avatar-aura-spin-medium" style={{ transformOrigin: `${center}px ${center}px` }} />
        </svg>
      );
    case "lightning-arc":
      return (
        <svg className="absolute inset-0 pointer-events-none" width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible' }}>
          <defs>
            <filter id="lightning-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          <circle cx={center} cy={center} r={center - 2} fill="none" stroke="#3B82F6" strokeWidth="1.5" opacity="0.3" filter="url(#lightning-glow)" />
          <g className="avatar-aura-spin-fast avatar-flicker" style={{ transformOrigin: `${center}px ${center}px` }}>
            <path d={`M${center},2 Q${center+10},${center-10} ${center+size/2-2},${center} T${center},${size-2} T${2},${center} T${center},2`} fill="none" stroke="#60A5FA" strokeWidth="2" filter="url(#lightning-glow)" strokeDasharray={`${size*0.4} ${size*0.6}`} />
            <path d={`M${center},4 Q${center-10},${center-10} ${4},${center} T${center},${size-4} T${size-4},${center} T${center},4`} fill="none" stroke="#93C5FD" strokeWidth="1" filter="url(#lightning-glow)" strokeDasharray={`${size*0.2} ${size*0.8}`} transform="rotate(45)" style={{ transformOrigin: `${center}px ${center}px` }} />
          </g>
        </svg>
      );
    case "void-aura":
      return (
        <svg className="absolute inset-0 pointer-events-none" width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible' }}>
          <defs>
            <filter id="void-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          <circle cx={center} cy={center} r={center - 4} fill="none" stroke="#4C1D95" strokeWidth="6" opacity="0.6" filter="url(#void-glow)" className="avatar-aura-pulse" />
          <g className="avatar-aura-spin-slow-reverse" style={{ transformOrigin: `${center}px ${center}px` }}>
            <circle cx={center} cy={center} r={center - 3} fill="none" stroke="#7C3AED" strokeWidth="2" strokeDasharray={`${size*0.8} ${size*0.4}`} filter="url(#void-glow)" opacity="0.8" />
            <circle cx={center} cy={center} r={center - 5} fill="none" stroke="#A78BFA" strokeWidth="1" strokeDasharray={`${size*0.3} ${size*0.7}`} filter="url(#void-glow)" opacity="0.9" />
          </g>
        </svg>
      );
    case "matrix-rain":
      return (
        <svg className="absolute inset-0 pointer-events-none" width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible' }}>
          <defs>
            <filter id="matrix-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          <circle cx={center} cy={center} r={center - 2} fill="none" stroke="#059669" strokeWidth="2" opacity="0.4" filter="url(#matrix-glow)" />
          <g className="avatar-aura-spin-fast" style={{ transformOrigin: `${center}px ${center}px` }}>
            {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => (
              <text key={i} x={center} y={8} fill={i%2===0 ? "#34D399" : "#10B981"} fontSize="10" fontFamily="monospace" fontWeight="bold" filter="url(#matrix-glow)" transform={`rotate(${deg} ${center} ${center})`} textAnchor="middle">
                {String.fromCharCode(0x30A0 + Math.random() * 96)}
              </text>
            ))}
          </g>
          <circle cx={center} cy={center} r={center - 5} fill="none" stroke="#6EE7B7" strokeWidth="1" strokeDasharray="2 4" opacity="0.6" className="avatar-aura-spin-medium" style={{ transformOrigin: `${center}px ${center}px` }} />
        </svg>
      );
    case "cyber-glitch":
      return (
        <svg className="absolute inset-0 pointer-events-none" width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible' }}>
          <defs>
            <filter id="glitch-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
            </filter>
          </defs>
          <g className="avatar-flicker">
            <circle cx={center - 2} cy={center} r={center - 3} fill="none" stroke="#E11D48" strokeWidth="2" opacity="0.7" strokeDasharray={`${size*0.7} ${size*0.1} ${size*0.2} ${size*0.1}`} className="avatar-aura-spin-fast" style={{ transformOrigin: `${center}px ${center}px` }} />
            <circle cx={center + 2} cy={center} r={center - 3} fill="none" stroke="#06B6D4" strokeWidth="2" opacity="0.7" strokeDasharray={`${size*0.5} ${size*0.2} ${size*0.3} ${size*0.2}`} className="avatar-aura-spin-medium" style={{ transformOrigin: `${center}px ${center}px` }} />
            <circle cx={center} cy={center} r={center - 3} fill="none" stroke="#F8FAFC" strokeWidth="1" filter="url(#glitch-glow)" strokeDasharray={`${size*0.9} ${size*0.2}`} className="avatar-aura-spin-slow-reverse" style={{ transformOrigin: `${center}px ${center}px` }} />
          </g>
        </svg>
      );
    case "frost-crystal":
      return (
        <svg className="absolute inset-0 pointer-events-none" width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible' }}>
          <defs>
            <filter id="frost-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          <circle cx={center} cy={center} r={center - 4} fill="none" stroke="#7DD3FC" strokeWidth="4" opacity="0.3" filter="url(#frost-glow)" />
          <g className="avatar-aura-spin-slow-reverse" style={{ transformOrigin: `${center}px ${center}px` }}>
            {[0, 60, 120, 180, 240, 300].map((deg, i) => (
              <polygon key={i} points={`${center},2 ${center+4},8 ${center},14 ${center-4},8`} fill="#E0F2FE" filter="url(#frost-glow)" transform={`rotate(${deg} ${center} ${center})`} opacity="0.8" />
            ))}
            <circle cx={center} cy={center} r={center - 2} fill="none" stroke="#BAE6FD" strokeWidth="1" strokeDasharray="10 10" filter="url(#frost-glow)" />
          </g>
        </svg>
      );
    case "phoenix-flame":
      return (
        <svg className="absolute inset-0 pointer-events-none" width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible' }}>
          <defs>
            <filter id="flame-glow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <linearGradient id="flame-grad" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#EA580C" />
              <stop offset="50%" stopColor="#EF4444" />
              <stop offset="100%" stopColor="#FDE047" />
            </linearGradient>
          </defs>
          <circle cx={center} cy={center} r={center - 3} fill="none" stroke="#9A3412" strokeWidth="4" opacity="0.4" filter="url(#flame-glow)" className="avatar-aura-pulse" />
          <g className="avatar-aura-spin-fast" style={{ transformOrigin: `${center}px ${center}px` }}>
            <path d={`M${center},2 Q${center+8},${center-8} ${center+size/2-2},${center} Q${center+4},${center-4} ${center},4`} fill="url(#flame-grad)" filter="url(#flame-glow)" opacity="0.9" />
            <path d={`M${center},${size-2} Q${center-8},${center+8} ${2},${center} Q${center-4},${center+4} ${center},${size-4}`} fill="url(#flame-grad)" filter="url(#flame-glow)" opacity="0.9" />
          </g>
          <g className="avatar-aura-spin-medium" style={{ transformOrigin: `${center}px ${center}px` }}>
            <circle cx={center} cy={center - (center - 3)} r={2} fill="#FEF08A" filter="url(#flame-glow)" />
            <circle cx={center + (center - 3)} cy={center} r={1.5} fill="#F97316" filter="url(#flame-glow)" />
          </g>
        </svg>
      );
    case "neon-pulse":
      return (
        <svg className="absolute inset-0 pointer-events-none" width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible' }}>
          <defs>
            <filter id="neon-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          <circle cx={center} cy={center} r={center - 3} fill="none" stroke="#D946EF" strokeWidth="2" filter="url(#neon-glow)" className="avatar-aura-pulse" />
          <circle cx={center} cy={center} r={center - 3} fill="none" stroke="#FDF4FF" strokeWidth="1" filter="url(#neon-glow)" className="avatar-aura-pulse" />
          <g className="avatar-aura-spin-fast" style={{ transformOrigin: `${center}px ${center}px` }}>
             <circle cx={center} cy={center} r={center - 5} fill="none" stroke="#C084FC" strokeWidth="2" strokeDasharray={`${size*0.4} ${size*0.6}`} filter="url(#neon-glow)" />
          </g>
          <g className="avatar-aura-spin-slow-reverse" style={{ transformOrigin: `${center}px ${center}px` }}>
             <circle cx={center} cy={center} r={center - 1} fill="none" stroke="#E879F9" strokeWidth="1" strokeDasharray={`${size*0.2} ${size*0.8}`} filter="url(#neon-glow)" />
          </g>
        </svg>
      );
    case "shadow-tendrils":
      return (
        <svg className="absolute inset-0 pointer-events-none" width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible' }}>
          <defs>
            <filter id="shadow-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="4" result="blur" />
            </filter>
          </defs>
          <circle cx={center} cy={center} r={center - 4} fill="none" stroke="#000000" strokeWidth="8" opacity="0.5" filter="url(#shadow-glow)" className="avatar-aura-pulse" />
          <g className="avatar-aura-spin-slow-reverse" style={{ transformOrigin: `${center}px ${center}px` }}>
            {[0, 90, 180, 270].map((deg, i) => (
               <path key={i} d={`M${center},${center - size/2 + 6} Q${center+15},${center - size/2 - 5} ${center+5},${center - size/2 + 10}`} fill="none" stroke="#171717" strokeWidth="3" filter="url(#shadow-glow)" transform={`rotate(${deg} ${center} ${center})`} strokeLinecap="round" opacity="0.8" />
            ))}
          </g>
          <circle cx={center} cy={center} r={center - 2} fill="none" stroke="#404040" strokeWidth="1" strokeDasharray="5 15" className="avatar-aura-spin-fast" style={{ transformOrigin: `${center}px ${center}px` }} opacity="0.6" />
        </svg>
      );
    default:
      return null;
  }
}
