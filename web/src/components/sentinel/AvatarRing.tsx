import { useMemo } from "react";

// Deterministic Discord-style ring + avatar derived from a UUID.
// God-Tier Cinematic Paper Archive Aura - Enhanced
const PALETTES: Array<[string, string, string, string, string]> = [
  ["#7C3AED", "#A855F7", "#EC4899", "#F472B6", "#FDA4AF"],
  ["#0369A1", "#06B6D4", "#3B82F6", "#8B5CF6", "#C084FC"],
  ["#B45309", "#F59E0B", "#EF4444", "#EC4899", "#F43F5E"],
  ["#047857", "#10B981", "#06B6D4", "#3B82F6", "#60A5FA"],
  ["#BE185D", "#F472B6", "#A855F7", "#6366F1", "#818CF8"],
  ["#0369A1", "#22D3EE", "#10B981", "#84CC16", "#A3E635"],
  ["#E11D48", "#FB7185", "#F59E0B", "#FACC15", "#FEF08A"],
  ["#6D28D9", "#8B5CF6", "#22D3EE", "#34D399", "#6EE7B7"],
];

function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

function initialsFrom(name?: string | null, email?: string | null): string {
  const src = (name || email || "?").trim();
  if (!src) return "?";
  const parts = src.split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

export type AvatarRingProps = {
  uuid?: string | null;
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  size?: number; // px — size of the picture itself
  ring?: boolean;
  ringWidth?: number; // px — thickness of the outer ring space
  ringGap?: number; // px — gap between picture and ring
  animate?: boolean; // auto-rotating energy field
  status?: "online" | "idle" | "offline" | null;
  className?: string;
};

export function AvatarRing({
  uuid,
  name,
  email,
  avatarUrl,
  size = 36,
  ring = true,
  ringWidth = 4,
  ringGap = 3,
  animate = true,
  status = "online",
  className = "",
}: AvatarRingProps) {
  const seed = (uuid || email || name || "anon").toString();
  const { a, b, c, d, e, gradientText, initials } = useMemo(() => {
    const idx = hashStr(seed) % PALETTES.length;
    const [c1, c2, c3, c4, c5] = PALETTES[idx];
    return {
      a: c1, b: c2, c: c3, d: c4, e: c5,
      gradientText: `linear-gradient(135deg, ${c1}, ${c3})`,
      initials: initialsFrom(name, email),
    };
  }, [seed, name, email]);

  const outerSize = size + (ring ? (ringWidth + ringGap) * 2 : 0);
  const dotSize = Math.max(8, Math.round(size * 0.28));

  const center = outerSize / 2;
  const radiusOutermost = center - 0.5; // Thin ambient ring
  const radiusOuter = center - ringWidth * 0.4; // Main dashed track
  const radiusMid = center - ringWidth * 1.0; // Dotted mid track
  const radiusInner = center - ringWidth * 1.6; // Inner core track

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 ${className}`}
      style={{ width: outerSize, height: outerSize }}
      aria-label={name || email || "User avatar"}
    >
      {ring && (
        <svg
          className={`absolute inset-0 pointer-events-none ${animate ? 'avatar-aura-pulse' : ''}`}
          width={outerSize}
          height={outerSize}
          viewBox={`0 0 ${outerSize} ${outerSize}`}
          style={{ overflow: 'visible' }}
        >
          <defs>
            <filter id={`glow-large-${seed}`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation={Math.max(2, size * 0.08)} result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id={`glow-crisp-${seed}`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation={Math.max(1, size * 0.03)} result="blur" />
              <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 2 0" result="boost" />
              <feComposite in="SourceGraphic" in2="boost" operator="over" />
            </filter>
            
            <linearGradient id={`grad1-${seed}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={a} />
              <stop offset="25%" stopColor={b} />
              <stop offset="50%" stopColor={c} />
              <stop offset="75%" stopColor={d} />
              <stop offset="100%" stopColor={e} />
            </linearGradient>
            
            <linearGradient id={`grad2-${seed}`} x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={e} />
              <stop offset="25%" stopColor={d} />
              <stop offset="50%" stopColor={c} />
              <stop offset="75%" stopColor={b} />
              <stop offset="100%" stopColor={a} />
            </linearGradient>

            <radialGradient id={`bg-glow-${seed}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={c} stopOpacity="0.2" />
              <stop offset="100%" stopColor={a} stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Radial Background Glow */}
          <circle cx={center} cy={center} r={radiusOutermost} fill={`url(#bg-glow-${seed})`} />

          {/* Outermost ambient ring glow */}
          <circle
            cx={center} cy={center} r={radiusOutermost}
            fill="none"
            stroke={`url(#grad1-${seed})`}
            strokeWidth="0.5"
            opacity="0.25"
            filter={`url(#glow-large-${seed})`}
          />

          {/* Outer rotating dashed ring */}
          <g style={{ transformOrigin: `${center}px ${center}px` }} className={animate ? "avatar-aura-spin-fast" : ""}>
            <circle
              cx={center} cy={center} r={radiusOuter}
              fill="none"
              stroke={`url(#grad2-${seed})`}
              strokeWidth={Math.max(1.5, ringWidth * 0.7)}
              strokeDasharray={`${radiusOuter * 0.3} ${radiusOuter * 0.9} ${radiusOuter * 1.8} ${radiusOuter * 0.5} ${radiusOuter * 0.8} ${radiusOuter * 0.4}`}
              strokeLinecap="round"
              filter={`url(#glow-crisp-${seed})`}
              opacity="0.9"
            />
          </g>

          {/* Mid dotted ring */}
          <g style={{ transformOrigin: `${center}px ${center}px` }} className={animate ? "avatar-aura-spin-medium" : ""}>
            <circle
              cx={center} cy={center} r={radiusMid}
              fill="none"
              stroke={`url(#grad1-${seed})`}
              strokeWidth={Math.max(1, ringWidth * 0.3)}
              strokeDasharray={`1 ${radiusMid * 0.8}`}
              strokeLinecap="round"
              filter={`url(#glow-crisp-${seed})`}
              opacity="0.8"
            />
          </g>

          {/* Inner counter-rotating continuous track */}
          <g style={{ transformOrigin: `${center}px ${center}px` }} className={animate ? "avatar-aura-spin-slow-reverse" : ""}>
            <circle
              cx={center} cy={center} r={radiusInner}
              fill="none"
              stroke={`url(#grad1-${seed})`}
              strokeWidth={Math.max(0.5, ringWidth * 0.2)}
              filter={`url(#glow-large-${seed})`}
              opacity="0.7"
            />
            <circle
              cx={center} cy={center} r={radiusInner}
              fill="none"
              stroke={`url(#grad2-${seed})`}
              strokeWidth={Math.max(1, ringWidth * 0.4)}
              strokeDasharray={`${radiusInner * 1.5} ${radiusInner * 0.8}`}
              strokeLinecap="round"
              opacity="0.9"
            />
          </g>
          
          {/* Orbiting Spark Particles */}
          <g style={{ transformOrigin: `${center}px ${center}px` }} className={animate ? "avatar-aura-spin-fast" : ""}>
            <circle cx={center} cy={center - radiusOuter} r={1.5} fill={e} filter={`url(#glow-crisp-${seed})`} />
            <circle cx={center + radiusOuter * 0.866} cy={center + radiusOuter * 0.5} r={1} fill={a} filter={`url(#glow-crisp-${seed})`} />
          </g>

          <g style={{ transformOrigin: `${center}px ${center}px` }} className={animate ? "avatar-aura-spin-medium" : ""}>
            <circle cx={center - radiusMid * 0.5} cy={center - radiusMid * 0.866} r={1.2} fill={c} filter={`url(#glow-crisp-${seed})`} />
            <circle cx={center + radiusMid} cy={center} r={1.5} fill={d} filter={`url(#glow-crisp-${seed})`} />
          </g>

          <g style={{ transformOrigin: `${center}px ${center}px` }} className={animate ? "avatar-aura-spin-slow-reverse" : ""}>
            <circle cx={center} cy={center + radiusInner} r={1} fill={b} filter={`url(#glow-crisp-${seed})`} />
            <circle cx={center - radiusInner * 0.866} cy={center + radiusInner * 0.5} r={0.8} fill={e} filter={`url(#glow-crisp-${seed})`} />
          </g>
        </svg>
      )}

      {/* Picture Container */}
      <div
        className="relative rounded-full overflow-hidden bg-background flex items-center justify-center font-semibold z-10 shadow-[0_0_10px_rgba(0,0,0,0.2)_inset]"
        style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.38)) }}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <span
            style={{
              background: gradientText,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              WebkitTextFillColor: "transparent",
              color: "transparent",
            }}
          >
            {initials}
          </span>
        )}
      </div>

      {/* Status Dot with Transition */}
      {status && (
        <span
          aria-hidden
          className={`absolute bottom-0 right-0 rounded-full ring-[2px] ring-background z-20 transition-colors duration-300 ${
            status === "online"
              ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]"
              : status === "idle"
                ? "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]"
                : "bg-zinc-500 shadow-none"
          }`}
          style={{ width: dotSize, height: dotSize }}
        />
      )}
    </div>
  );
}
