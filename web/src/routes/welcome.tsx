import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  useState, useCallback, useEffect, useRef,
  useMemo, memo,
} from "react";
import { motion, AnimatePresence, useSpring } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "@/components/ui/toast";
import {
  User, Lock, Fingerprint, Phone,
  ChevronRight, ChevronLeft, Loader2, Check,
  Sparkles, ArrowRight, Wand2, Shield, Droplet, Waves, Palette
} from "lucide-react";
import { SuminagashiOrb, useTypingVelocity } from "@/components/SuminagashiOrb";
import { SuminagashiBackground, type SuminagashiHandle } from "@/components/SuminagashiBackground";

export const Route = createFileRoute("/welcome")({
  head: () => ({
    meta: [
      { title: "Welcome · Obylon by Umbraxis" },
      { name: "description", content: "Complete your operator identity." },
    ],
  }),
  component: WelcomePage,
});

const detectLowEnd = (): boolean => {
  if (typeof navigator === "undefined") return true;
  try {
    if (localStorage.getItem("OBYLON_FORCE_FLUID") === "true") return false;
  } catch (e) {}
  const cores  = navigator.hardwareConcurrency ?? 2;
  const memory = (navigator as any).deviceMemory ?? 2;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mobile  = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  return reduced || cores <= 2 || memory <= 2 || (mobile && cores <= 4);
};
const prefersReducedMotion = (): boolean =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const playClick = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.04);
    gain.gain.setValueAtTime(0.02, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
    osc.start(); osc.stop(ctx.currentTime + 0.04);
  } catch {}
};

const playLockSeal = () => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    [0, 0.06, 0.13].forEach((delay, i) => {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(280 + i * 140, ctx.currentTime + delay);
      osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + delay + 0.09);
      gain.gain.setValueAtTime(0.014, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.1);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.11);
    });
  } catch {}
};

const STEPS = [
  { id: "welcome",  label: "Welcome",  icon: Sparkles   },
  { id: "name",     label: "Identity", icon: User       },
  { id: "password", label: "Security", icon: Lock       },
  { id: "extras",   label: "Optional", icon: Fingerprint },
] as const;

const pageVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 300 : -300, opacity: 0, scale: 0.93, filter: "blur(8px)" }),
  center: { x: 0, opacity: 1, scale: 1, filter: "blur(0px)", transition: { type: "spring", stiffness: 260, damping: 30, mass: 0.8 } },
  exit: (dir: number) => ({ x: dir < 0 ? 300 : -300, opacity: 0, scale: 0.93, filter: "blur(8px)", transition: { duration: 0.28 } }),
};
const pageVariantsReduced = {
  enter: { opacity: 0 },
  center: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};
const fieldVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: 0.1 + i * 0.1, type: "spring", stiffness: 300, damping: 24 },
  }),
};

const COMMON_PASSWORDS = new Set([
  "password","password1","123456","12345678","1234567890","qwerty","abc123",
  "letmein","welcome","monkey","dragon","master","sunshine","princess","football",
  "shadow","superman","michael","jessica","login","admin","iloveyou","111111",
  "000000","654321","pass","test","guest","hello","access","solo","batman",
]);

const WEAK_QUIPS = [
  "This one might not survive even the most curious student.",
  "A timeless classic\u2026 perhaps a bit too timeless.",
  "Giving strong \u2018Post-it on the monitor\u2019 energy.",
  "The grid has seen this approximately four billion times.",
  "Your future self is wincing gently from the future.",
  "Solid effort, but we can do better than \u2018password123\u2019 energy.",
  "Even the school printer could guess this one.",
  "Security professionals everywhere just shuddered slightly.",
];

function calcPasswordStrength(pwd: string): { score: number; label: "Weak" | "Fair" | "Strong"; crackTime: string; quip: string } {
  if (!pwd.length) return { score: 0, label: "Weak", crackTime: "", quip: "" };
  if (COMMON_PASSWORDS.has(pwd.toLowerCase()))
    return { score: 5, label: "Weak", crackTime: "Estimated crack time: instant", quip: "A timeless classic\u2026 perhaps a bit too timeless." };
  let score = 0;
  score += Math.min(pwd.length * 4, 40);
  if (/[A-Z]/.test(pwd)) score += 10;
  if (/[a-z]/.test(pwd)) score += 10;
  if (/[0-9]/.test(pwd)) score += 10;
  if (/[^A-Za-z0-9]/.test(pwd)) score += 15;
  if (pwd.length >= 12) score += 10;
  if (pwd.length >= 16) score += 5;
  const uniqueRatio = new Set(pwd).size / pwd.length;
  if (uniqueRatio < 0.5) score = Math.max(score - 15, 0);
  const charsetSize =
    (/[a-z]/.test(pwd) ? 26 : 0) + (/[A-Z]/.test(pwd) ? 26 : 0) +
    (/[0-9]/.test(pwd) ? 10 : 0) + (/[^A-Za-z0-9]/.test(pwd) ? 32 : 0);
  const seconds = Math.pow(charsetSize || 1, pwd.length) / 1e10;
  const crackTime =
    seconds < 60       ? "Estimated crack time: seconds" :
    seconds < 3600     ? `\u2248 ${Math.round(seconds/60)} minutes` :
    seconds < 86400    ? `\u2248 ${Math.round(seconds/3600)} hours` :
    seconds < 2592000  ? `\u2248 ${Math.round(seconds/86400)} days` :
    seconds < 31536000 ? `\u2248 ${Math.round(seconds/2592000)} months` :
    seconds < 3.15e9   ? `\u2248 ${Math.round(seconds/31536000)} years` : "centuries";
  const label: "Weak" | "Fair" | "Strong" = score >= 70 ? "Strong" : score >= 45 ? "Fair" : "Weak";
  const quip = label === "Weak" ? WEAK_QUIPS[pwd.length % WEAK_QUIPS.length] : "";
  return { score: Math.min(score, 100), label, crackTime, quip };
}

const ADJECTIVES = ["Obsidian","Crimson","Phantom","Vaulted","Cipher","Lattice","Wraith","Abyssal"];
const NOUNS = ["Sentry","Vector","Nexus","Bastion","Protocol","Circuit","Aegis","Sentinel"];
const SYMS  = "!@#$%^&*";
function generateStrongPassword() {
  const a = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const n = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const d = String(Math.floor(Math.random() * 900) + 100);
  const s = SYMS[Math.floor(Math.random() * SYMS.length)];
  return `${a}${n}${d}${s}`;
}

function generateNameSuggestions(prefix: string): string[] {
  if (!prefix) return [];
  const clean = prefix.replace(/[^a-zA-Z0-9]/g, "");
  const base  = clean.charAt(0).toUpperCase() + clean.slice(1);
  const out: string[] = [];
  if (base) out.push(base);
  const parts = prefix.split(/[\._\-]/);
  if (parts.length > 1) {
    const joined = parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join("");
    if (joined !== base) out.push(joined);
    const initials = parts.map(p => p.charAt(0).toUpperCase()).join("") + parts[parts.length-1].slice(1);
    if (!out.includes(initials)) out.push(initials);
  }
  const nums = prefix.match(/\d+/)?.[0] ?? "";
  const letOnly = prefix.replace(/[^a-zA-Z]/g, "");
  if (letOnly && letOnly !== clean) {
    const v = letOnly.charAt(0).toUpperCase() + letOnly.slice(1) + nums;
    if (!out.includes(v)) out.push(v);
  }
  return out.slice(0, 4);
}

function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (!d.length) return "";
  if (raw.startsWith("+")) {
    if (d.length <= 1) return `+${d}`;
    if (d.length <= 4) return `+${d[0]} (${d.slice(1)}`;
    if (d.length <= 7) return `+${d[0]} (${d.slice(1,4)}) ${d.slice(4)}`;
    if (d.length <= 11) return `+${d[0]} (${d.slice(1,4)}) ${d.slice(4,7)}-${d.slice(7)}`;
    return `+${d[0]} (${d.slice(1,4)}) ${d.slice(4,7)}-${d.slice(7,11)}`;
  }
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0,3)}) ${d.slice(3)}`;
  if (d.length <= 10) return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}`;
  return `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6,10)}`;
}

const GridScan = memo(({ intensity }: { intensity: number }) => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl" aria-hidden="true">
    <div className="absolute inset-0" style={{
      backgroundImage:
        "repeating-linear-gradient(0deg,transparent,transparent 18px,rgba(140,20,20,0.06) 18px,rgba(140,20,20,0.06) 19px)," +
        "repeating-linear-gradient(90deg,transparent,transparent 18px,rgba(140,20,20,0.04) 18px,rgba(140,20,20,0.04) 19px)",
      opacity: Math.min(intensity * 0.08 + 0.02, 0.18),
      transition: "opacity 0.3s",
    }} />
    {intensity > 0 && (
      <motion.div className="absolute left-0 right-0 h-[1px]"
        style={{ background: "linear-gradient(90deg,transparent,rgba(140,20,20,0.5),transparent)" }}
        animate={{ y: [0, 80, 0] }} transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }} />
    )}
  </div>
));

const FingerprintRipple = memo(({ active }: { active: boolean }) => {
  if (!active) return null;
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden="true">
      {[0,1,2].map(i => (
        <motion.div key={i} className="absolute rounded-full border border-blood/30"
          initial={{ scale: 0.8, opacity: 0.6 }} animate={{ scale: 2.2, opacity: 0 }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.4, ease: "easeOut" }}
          style={{ width: 40, height: 40 }} />
      ))}
    </div>
  );
});

const PasskeyDemo = memo(({ show }: { show: boolean }) => {
  if (!show) return null;
  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
      className="mt-2 p-3 rounded-xl bg-foreground/3 border border-foreground/8 flex items-center gap-3" aria-live="polite">
      <div className="relative flex-shrink-0">
        <motion.div className="w-8 h-8 rounded-full border border-blood/40 flex items-center justify-center"
          animate={{ boxShadow: ["0 0 0px rgba(140,20,20,0)","0 0 12px rgba(140,20,20,0.4)","0 0 0px rgba(140,20,20,0)"] }}
          transition={{ duration: 1.6, repeat: Infinity }}>
          <Fingerprint className="w-4 h-4 text-blood/60" />
        </motion.div>
        <motion.div className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-sage/80 flex items-center justify-center"
          initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1.2, type: "spring", stiffness: 400 }}>
          <Check className="w-2 h-2 text-background" />
        </motion.div>
      </div>
      <div>
        <p className="text-[11px] font-mono text-foreground/60 uppercase tracking-wider">Biometric Verified</p>
        <p className="text-[10px] text-muted-foreground/40 mt-0.5">No password needed on this device</p>
      </div>
    </motion.div>
  );
});

const ProgressBar = memo(({ step }: { step: number }) => (
  <div className="absolute top-8 left-1/2 -translate-x-1/2 z-20 pointer-events-auto touch-auto" role="navigation" aria-label="Setup progress">
    <div className="flex items-center gap-2">
      {STEPS.map((s, i) => {
        const Icon = s.icon;
        const isActive = i === step, isDone = i < step;
        return (
          <div key={s.id} className="flex items-center gap-2">
            <motion.div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-colors duration-500 ${isActive ? "text-background shadow-lg" : isDone ? "bg-foreground/15 text-foreground" : "bg-foreground/5 text-muted-foreground/50"}`}
              style={isActive ? { background: "linear-gradient(135deg,var(--blood),#3a0a0a)" } : undefined}
              animate={isDone ? { scale: [1,1.15,1] } : {}} transition={{ duration: 0.35 }}
              layout aria-current={isActive ? "step" : undefined}
              aria-label={`${s.label}${isDone ? " (complete)" : isActive ? " (current)" : ""}`}
            >
              {isDone ? (
                <motion.div initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 400, damping: 20 }}>
                  <Check className="w-3.5 h-3.5" aria-hidden="true" />
                </motion.div>
              ) : <Icon className="w-3.5 h-3.5" aria-hidden="true" />}
              {isActive && (
                <motion.span initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: "auto" }} exit={{ opacity: 0, width: 0 }}
                  className="text-[11px] font-mono uppercase tracking-[0.15em] whitespace-nowrap overflow-hidden">{s.label}</motion.span>
              )}
            </motion.div>
            {i < STEPS.length - 1 && (
              <div className={`w-6 h-[1.5px] transition-colors duration-500 ${isDone ? "bg-foreground/30" : "bg-foreground/8"}`} />
            )}
          </div>
        );
      })}
    </div>
  </div>
));

const SuccessOverlay = memo(({ visible }: { visible: boolean }) => (
  <AnimatePresence>
    {visible && (
      <motion.div className="fixed inset-0 z-[999] flex items-center justify-center"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }} aria-hidden="true">
        <motion.div className="absolute rounded-full"
          initial={{ width: 100, height: 100, opacity: 0.95 }}
          animate={{ width: "280vmax", height: "280vmax", opacity: 1 }}
          transition={{ duration: 0.8, ease: [0.22,1,0.36,1] }}
          style={{ background: "radial-gradient(ellipse,#1a0404 0%,#0a0000 55%,#050000 100%)" }} />
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(140,20,20,0.04) 3px,rgba(140,20,20,0.04) 4px)",
          animation: "scanlines 0.1s steps(1) infinite",
        }} />
        <motion.div className="absolute inset-0 pointer-events-none"
          initial={{ opacity: 0 }} animate={{ opacity: [0,0.14,0] }} transition={{ duration: 0.6, delay: 0.1 }}
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg,transparent,transparent 40px,rgba(140,20,20,0.3) 40px,rgba(140,20,20,0.3) 41px)," +
              "repeating-linear-gradient(90deg,transparent,transparent 40px,rgba(140,20,20,0.2) 40px,rgba(140,20,20,0.2) 41px)",
          }} />
        <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.18 }}
          className="relative z-10 w-16 h-16 rounded-full bg-blood/10 border border-blood/30 flex items-center justify-center">
          <Check className="w-7 h-7 text-blood" />
        </motion.div>
        <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.4 }}
          className="absolute bottom-[40%] z-10 text-[11px] font-mono uppercase tracking-[0.3em] text-blood/60">
          Identity Established
        </motion.p>
      </motion.div>
    )}
  </AnimatePresence>
));

const GlitchEasterEgg = memo(({ visible }: { visible: boolean }) => (
  <AnimatePresence>
    {visible && (
      <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
        className="absolute -bottom-10 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-mono text-blood/70 tracking-widest"
        role="status" aria-live="polite">
        <motion.span animate={{ opacity: [1,0.2,1,0.4,1] }} transition={{ duration: 0.18, repeat: 4 }}>
          // You weren&apos;t supposed to find this. Welcome to the deep grid.
        </motion.span>
      </motion.div>
    )}
  </AnimatePresence>
));

function WelcomePage() {
  const navigate = useNavigate();
  const { user, loading, refreshProfile } = useAuth();

  const [step, setStep]         = useState(0);
  const [dir,  setDir]          = useState(1);
  const [isExiting, setIsExiting] = useState(false);

  const [name, setName]         = useState("");
  const [nameForgeFired, setForge] = useState(false);
  const [lastConfirmed, setConfirmed] = useState("");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [phone, setPhone]       = useState("");
  const [storageLoaded, setStorageLoaded] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [passkeyDone, setPasskeyDone] = useState(false);
  const [fpHover, setFpHover]   = useState(false);
  const [showPasskeyDemo, setShowDemo] = useState(false);

  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const mousePosRef = useRef({ x: 0, y: 0 });

  const [holdProgress, setHoldProgress] = useState(0);
  const [easterEgg, setEasterEgg] = useState(false);
  const holdRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdT0  = useRef(0);
  const sumiRef = useRef<SuminagashiHandle>(null);

  const isLowEnd      = useMemo(() => detectLowEnd(), []);
  const reducedMotion = useMemo(() => prefersReducedMotion(), []);
  const pageVars      = reducedMotion ? pageVariantsReduced : pageVariants;

  const emailPrefix    = useMemo(() => (user?.email ?? "").split("@")[0], [user?.email]);
  const nameSuggestions = useMemo(() => generateNameSuggestions(emailPrefix), [emailPrefix]);
  const pwdStrength    = useMemo(() => calcPasswordStrength(password), [password]);
  const passwordValid  = password.length >= 6 && !COMMON_PASSWORDS.has(password.toLowerCase());
  const passwordsMatch = password === confirm && confirm.length > 0;
  const lockEngaged    = passwordsMatch && passwordValid;
  const gridIntensity  = useMemo(() => Math.min(name.length / 20, 1), [name.length]);
  const typingVelocity = useTypingVelocity(password);

  const parallaxX = useSpring(0, { stiffness: 40, damping: 20 });
  const parallaxY = useSpring(0, { stiffness: 40, damping: 20 });

  const prevLockRef = useRef(false);
  useEffect(() => {
    if (lockEngaged && !prevLockRef.current) { playLockSeal(); navigator.vibrate?.([30,10,60]); }
    prevLockRef.current = lockEngaged;
  }, [lockEngaged]);

  useEffect(() => {
    if (!loading && user && !storageLoaded) {
      try {
        const raw = localStorage.getItem(`obylon_onboarding_${user.id}`);
        if (raw) { const p = JSON.parse(raw); setStep(p.step||0); setName(p.name||""); setPhone(p.phone||""); }
        else if (emailPrefix) { const s = generateNameSuggestions(emailPrefix); if (s[0]) setName(s[0]); }
      } catch {}
      setStorageLoaded(true);
    }
  }, [loading, user, storageLoaded, emailPrefix]);

  useEffect(() => {
    if (user && storageLoaded) localStorage.setItem(`obylon_onboarding_${user.id}`, JSON.stringify({ step, name, phone }));
  }, [step, name, phone, user, storageLoaded]);

  useEffect(() => {
    if (!loading) {
      if (!user) navigate({ to: "/login", replace: true });
      else if (user.user_metadata?.needs_setup === false) navigate({ to: "/", replace: true });
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    if (isLowEnd) return;
    let ticking = false;
    const onMove = (e: MouseEvent | TouchEvent) => {
      let clientX, clientY;
      if ('touches' in e) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = (e as MouseEvent).clientX;
        clientY = (e as MouseEvent).clientY;
      }
      mousePosRef.current = { x: clientX, y: clientY };
      if (!ticking) { ticking = true; requestAnimationFrame(() => { setMousePos({ ...mousePosRef.current }); ticking = false; }); }
    };
    window.addEventListener("mousemove", onMove as EventListener, { passive: true });
    window.addEventListener("touchmove", onMove as EventListener, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove as EventListener);
      window.removeEventListener("touchmove", onMove as EventListener);
    };
  }, [isLowEnd]);

  useEffect(() => {
    if (isLowEnd || reducedMotion) return;
    const cx = window.innerWidth/2, cy = window.innerHeight/2;
    parallaxX.set(((mousePos.x - cx)/cx)*8);
    parallaxY.set(((mousePos.y - cy)/cy)*8);
  }, [mousePos, isLowEnd, reducedMotion, parallaxX, parallaxY]);

  const goNext = useCallback(() => { playClick(); setDir(1);  setStep(s => Math.min(s+1, STEPS.length-1)); }, []);
  const goBack = useCallback(() => { playClick(); setDir(-1); setStep(s => Math.max(s-1, 0)); }, []);

  const handleNameConfirm = useCallback(() => {
    if (!name.trim() || name === lastConfirmed) return;
    setConfirmed(name); setForge(false);
    requestAnimationFrame(() => setForge(true));
    setTimeout(() => setForge(false), 900);
  }, [name, lastConfirmed]);

  const handleNameSuggestion = useCallback((s: string) => {
    playClick(); setName(s); setConfirmed(s); setForge(false);
    requestAnimationFrame(() => setForge(true));
    setTimeout(() => setForge(false), 900);
  }, []);

  const startHold = useCallback(() => {
    if (step !== 0 || easterEgg) return;
    holdT0.current = Date.now();
    holdRef.current = setInterval(() => {
      const p = Math.min((Date.now() - holdT0.current) / 3000, 1);
      setHoldProgress(p);
      if (p >= 1) {
        clearInterval(holdRef.current!);
        setEasterEgg(true);
        navigator.vibrate?.([20,30,20,30,100]);
        setTimeout(() => { setEasterEgg(false); setHoldProgress(0); }, 4500);
      }
    }, 50);
  }, [step, easterEgg]);

  const stopHold = useCallback(() => {
    if (holdRef.current) { clearInterval(holdRef.current); holdRef.current = null; }
    if (!easterEgg) setHoldProgress(0);
  }, [easterEgg]);

  const handleFinish = async () => {
    playClick();
    if (!user) return;
    if (password.length < 6)                          { toast.error("Password must be at least 6 characters."); setDir(-1); setStep(2); return; }
    if (COMMON_PASSWORDS.has(password.toLowerCase())) { toast.error("Password too common. Choose a stronger one."); setDir(-1); setStep(2); return; }
    if (password !== confirm)                         { toast.error("Passwords do not match."); setDir(-1); setStep(2); return; }
    if (!name.trim())                                 { toast.error("Please enter your name."); setDir(-1); setStep(1); return; }
    setSubmitting(true);
    try {
      const { error: pe } = await supabase.auth.updateUser({ password });
      if (pe) throw pe;
      const pd: Record<string,any> = { user_id: user.id, display_name: name.trim() };
      if (phone.trim()) pd.phone = phone.trim();
      const { error: fe } = await supabase.from("profiles").upsert(pd, { onConflict: "user_id" });
      if (fe) throw fe;
      toast.success("Identity established. Welcome aboard.");
      new Audio("/sounds/grid-entry.mp3").play().catch(() => {});
      setIsExiting(true);
      setTimeout(async () => {
        localStorage.removeItem(`obylon_onboarding_${user.id}`);
        const meta: Record<string,any> = { display_name: name.trim(), needs_setup: false };
        if (phone.trim()) meta.phone = phone.trim();
        await supabase.auth.updateUser({ data: meta });
        await refreshProfile?.();
        navigate({ to: "/", replace: true });
      }, 900);
    } catch (err: any) {
      toast.error(err.message || "Setup failed. Please try again.");
      setSubmitting(false);
    }
  };

  if (loading || !storageLoaded) return <div className="min-h-screen bg-background" />;

  const strengthColor =
    pwdStrength.label === "Strong" ? "var(--sage)" :
    pwdStrength.label === "Fair"   ? "var(--amber)" : "var(--blood)";

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-transparent overflow-hidden touch-none" role="main" style={{ touchAction: 'none' }}>
      <SuminagashiBackground ref={sumiRef} />
      <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5, duration: 0.6 }} 
        className="absolute bottom-6 z-50 flex items-center gap-1.5 p-1.5 rounded-full bg-white/40 dark:bg-black/20 backdrop-blur-xl border border-white/60 dark:border-white/10 shadow-2xl pointer-events-auto">
        <button onClick={() => sumiRef.current?.wash()} className="flex items-center gap-2 px-4 py-2.5 rounded-full hover:bg-white/60 dark:hover:bg-white/10 text-slate-800 dark:text-slate-200 transition-colors font-medium text-xs uppercase tracking-widest" aria-label="Wash Canvas" title="Wash Canvas">
          <Waves className="w-4 h-4" /> Wash
        </button>
        <div className="w-[1px] h-6 bg-slate-400/30" />
        <button onClick={() => sumiRef.current?.dropInk()} className="flex items-center gap-2 px-4 py-2.5 rounded-full hover:bg-white/60 dark:hover:bg-white/10 text-slate-800 dark:text-slate-200 transition-colors font-medium text-xs uppercase tracking-widest" aria-label="Drop Ink" title="Drop Ink">
          <Droplet className="w-4 h-4" /> Ink
        </button>
        <div className="w-[1px] h-6 bg-slate-400/30" />
        <button onClick={() => {
          const colors = ['sumi', 'ai', 'shu', 'matsuba'];
          const randomColor = colors[Math.floor(Math.random() * colors.length)];
          sumiRef.current?.setColor(randomColor);
        }} className="flex items-center gap-2 px-4 py-2.5 rounded-full hover:bg-white/60 dark:hover:bg-white/10 text-slate-800 dark:text-slate-200 transition-colors font-medium text-xs uppercase tracking-widest" aria-label="Change Color" title="Change Color">
          <Palette className="w-4 h-4" /> Color
        </button>
      </motion.div>
      <ProgressBar step={step} />

      <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-0">
        <div className="w-full max-w-2xl h-[75vh] bg-background/50 backdrop-blur-[32px] rounded-[3rem] border border-foreground/10 shadow-2xl" />
      </div>

      <div className="relative w-full max-w-lg px-6 z-10 pointer-events-none">
        <AnimatePresence mode="wait" custom={dir}>

          {step === 0 && (
            <motion.div key="welcome" custom={dir} variants={pageVars} initial="enter" animate="center" exit="exit"
              className="flex flex-col items-center text-center pointer-events-auto touch-auto mt-12">

              <motion.div initial={{ opacity:0, y:24 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.4, duration:0.6 }} className="space-y-6 w-full flex flex-col items-center">
                <div className="flex items-center justify-center gap-2 text-[10px] uppercase tracking-[0.45em] font-mono text-blood/90 bg-foreground/5 px-4 py-1.5 rounded-full border border-foreground/10">
                  <span className="w-1.5 h-1.5 rounded-full bg-blood heartbeat-dot" aria-hidden="true" />
                  Obylon by Umbraxis
                </div>
                
                <div 
                  className="relative cursor-pointer select-none py-6"
                  onMouseDown={startHold} onMouseUp={stopHold} onMouseLeave={stopHold}
                  onTouchStart={startHold} onTouchEnd={stopHold}
                >
                  <GlitchEasterEgg visible={easterEgg} />
                  <h1 className="font-serif text-[clamp(2.5rem,8vw,4.5rem)] font-bold leading-tight tracking-tight break-all max-w-[90vw] text-foreground">
                    {(() => {
                      const first = user?.email?.split("@")[0] || "Operator";
                      return (
                        <span>
                          Hello, {first.charAt(0).toUpperCase() + first.slice(1)}.
                        </span>
                      );
                    })()}
                  </h1>
                </div>

                <p className="text-base text-muted-foreground max-w-sm mx-auto leading-relaxed font-medium">
                  You&apos;ve been invited to the grid. Let&apos;s establish your identity and secure your access in a few quick steps.
                </p>
              </motion.div>

              <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.7 }}
                className="mt-10 flex flex-col md:flex-row items-center gap-4">
                <button onClick={goNext}
                  className="group flex items-center justify-center gap-3 w-full md:w-auto px-8 py-4 rounded-2xl bg-foreground text-background font-semibold text-sm uppercase tracking-[0.15em] shadow-xl hover:shadow-2xl hover:scale-[1.03] active:scale-[0.98] transition-all duration-300 min-h-[52px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/50"
                  aria-label="Get Started">
                  Get Started
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
                </button>
                <button onClick={async () => { playClick(); await supabase.auth.signOut(); navigate({ to:"/login", replace:true }); }}
                  className="w-full md:w-auto px-6 py-4 rounded-2xl bg-foreground/5 hover:bg-foreground/10 text-foreground font-semibold text-sm uppercase tracking-[0.15em] transition-all min-h-[52px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30">
                  Sign in as different user
                </button>
              </motion.div>
            </motion.div>
          )}

          {step === 1 && (
            <motion.div key="name" custom={dir} variants={pageVars} initial="enter" animate="center" exit="exit"
              className="flex flex-col items-center pointer-events-auto touch-auto">
              <motion.div custom={0} variants={fieldVariants} initial="hidden" animate="visible" className="text-center mb-8">
                <motion.div className="w-16 h-16 rounded-2xl bg-foreground/8 flex items-center justify-center mx-auto mb-6 border border-foreground/10"
                  animate={nameForgeFired ? {
                    boxShadow:["0 0 0px rgba(140,20,20,0)","0 0 24px rgba(140,20,20,0.5)","0 0 0px rgba(140,20,20,0)"],
                    borderColor:["rgba(255,255,255,0.1)","rgba(140,20,20,0.5)","rgba(255,255,255,0.1)"],
                  } : {}} transition={{ duration:0.85 }}>
                  <User className="w-7 h-7 text-foreground/70" aria-hidden="true" />
                </motion.div>
                <h2 className="font-serif text-3xl md:text-4xl tracking-tight text-foreground">What should we call you?</h2>
                <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">This will be your display name across the entire grid.</p>
              </motion.div>

              <motion.div custom={1} variants={fieldVariants} initial="hidden" animate="visible" className="w-full max-w-sm">
                <label htmlFor="display-name" className="block text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-2">Display Designation</label>
                <div className="relative">
                  {!isLowEnd && <GridScan intensity={gridIntensity} />}
                  {nameForgeFired && (
                    <motion.div className="absolute inset-0 rounded-xl pointer-events-none z-20"
                      initial={{ opacity:0 }} animate={{ opacity:[0,1,0.6,1,0] }} transition={{ duration:0.9 }}
                      style={{ boxShadow:"inset 0 0 0 1.5px rgba(140,20,20,0.7),0 0 24px rgba(140,20,20,0.3)" }} aria-hidden="true" />
                  )}
                  <input id="display-name" type="text" value={name}
                    onChange={e => setName(e.target.value)} onFocus={playClick}
                    onBlur={handleNameConfirm}
                    onKeyDown={e => { if (e.key==="Enter") { handleNameConfirm(); goNext(); } }}
                    placeholder="Your name..." autoComplete="off" autoFocus
                    aria-describedby="name-suggestions"
                    className="relative z-10 w-full bg-background/50 border border-border/50 rounded-xl px-5 py-4 text-base focus:outline-none focus:ring-2 focus:ring-foreground/20 focus:border-foreground/30 font-medium placeholder:text-muted-foreground/40 shadow-sm backdrop-blur-sm transition-colors duration-200 min-h-[52px]" />
                </div>
                {nameSuggestions.length > 0 && (
                  <motion.div id="name-suggestions" initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }}
                    transition={{ delay:0.25, type:"spring", stiffness:300, damping:24 }}
                    className="mt-3 flex flex-wrap gap-2" aria-label="Name suggestions">
                    {nameSuggestions.map(s => (
                      <button key={s} type="button" onClick={() => handleNameSuggestion(s)}
                        className={`relative px-3 py-1.5 rounded-lg text-xs font-mono border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30 group ${name===s ? "border-foreground/30 bg-foreground/10 text-foreground" : "border-border/40 bg-foreground/4 text-muted-foreground hover:text-foreground hover:border-foreground/20 hover:bg-foreground/8"}`}
                        aria-pressed={name===s}>
                        <span className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                          style={{ boxShadow:"inset 0 0 0 1px rgba(140,20,20,0.2),0 0 8px rgba(140,20,20,0.1)" }} aria-hidden="true" />
                        {s}
                      </button>
                    ))}
                  </motion.div>
                )}
              </motion.div>

              <motion.div custom={2} variants={fieldVariants} initial="hidden" animate="visible" className="flex items-center gap-3 mt-8 w-full max-w-sm">
                <button onClick={goBack} className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl border border-border/50 text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-all text-sm font-medium min-h-[52px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30" aria-label="Go back to Welcome">
                  <ChevronLeft className="w-4 h-4" aria-hidden="true" /> Back
                </button>
                <motion.button onClick={() => { handleNameConfirm(); goNext(); }} disabled={!name.trim()}
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-foreground text-background font-semibold text-sm uppercase tracking-wider shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] disabled:opacity-30 disabled:pointer-events-none transition-all duration-300 min-h-[52px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/50"
                  animate={name.trim() ? { boxShadow:["0 0 0px rgba(140,20,20,0)","0 0 18px rgba(140,20,20,0.25)","0 0 0px rgba(140,20,20,0)"] } : {}}
                  transition={{ duration:2.5, repeat:Infinity }} aria-label="Continue to Security step">
                  Continue <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </motion.button>
              </motion.div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="password" custom={dir} variants={pageVars} initial="enter" animate="center" exit="exit"
              className="flex flex-col items-center pointer-events-auto touch-auto">
              <motion.div custom={0} variants={fieldVariants} initial="hidden" animate="visible" className="text-center mb-6">
                <div className="flex justify-center mb-5 relative" style={{ width:120, height:120, margin:"0 auto" }}>
                  <AnimatePresence>
                    {lockEngaged && (
                      <motion.div initial={{ scale:0, opacity:0 }} animate={{ scale:1, opacity:1 }} exit={{ scale:0, opacity:0 }}
                        className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-sage/15 border border-sage/40 flex items-center justify-center">
                        <Shield className="w-3.5 h-3.5 text-sage" aria-hidden="true" />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <h2 className="font-serif text-3xl md:text-4xl tracking-tight text-foreground">Secure your access</h2>
                <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">Choose a strong password to protect your operator credentials.</p>
              </motion.div>

              <motion.div custom={1} variants={fieldVariants} initial="hidden" animate="visible" className="w-full max-w-sm space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label htmlFor="password" className="text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground">Password</label>
                    <button type="button" onClick={() => { playClick(); const g=generateStrongPassword(); setPassword(g); setConfirm(g); }}
                      className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-blood/60 hover:text-blood transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blood/40 rounded px-1 py-0.5"
                      aria-label="Generate a strong password">
                      <Wand2 className="w-3 h-3" aria-hidden="true" /> Generate
                    </button>
                  </div>
                  <input id="password" type="password" value={password}
                    onChange={e => setPassword(e.target.value)} onFocus={playClick}
                    placeholder="Minimum 6 characters..." autoFocus
                    aria-describedby="pwd-strength pwd-crack pwd-quip"
                    className="w-full bg-background/50 border border-border/50 rounded-xl px-5 py-4 text-base focus:outline-none focus:ring-2 focus:ring-foreground/20 focus:border-foreground/30 font-medium placeholder:text-muted-foreground/40 shadow-sm backdrop-blur-sm transition-colors duration-200 min-h-[52px]" />
                  <AnimatePresence>
                    {password.length > 0 && (
                      <motion.div id="pwd-strength" initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:"auto" }} exit={{ opacity:0, height:0 }}
                        className="mt-2 space-y-1" role="status" aria-live="polite">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1 rounded-full bg-foreground/10 overflow-hidden" aria-hidden="true">
                            <motion.div className="h-full rounded-full" style={{ backgroundColor:strengthColor }}
                              initial={{ width:0 }} animate={{ width:`${pwdStrength.score}%` }}
                              transition={{ type:"spring", stiffness:200, damping:22, mass:0.6 }} />
                          </div>
                          <span className="text-[10px] font-mono uppercase tracking-wider" style={{ color:strengthColor }}>{pwdStrength.label}</span>
                        </div>
                        {pwdStrength.crackTime && (
                          <p id="pwd-crack" className="text-[10px] font-mono text-muted-foreground/60">{pwdStrength.crackTime}</p>
                        )}
                        <AnimatePresence>
                          {pwdStrength.label === "Weak" && pwdStrength.quip && (
                            <motion.p id="pwd-quip" key={pwdStrength.quip}
                              initial={{ opacity:0, y:-3 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-3 }}
                              transition={{ duration:0.35 }}
                              className="text-[10px] font-mono italic text-muted-foreground/45" aria-live="polite">
                              {pwdStrength.quip}
                            </motion.p>
                          )}
                        </AnimatePresence>
                        {COMMON_PASSWORDS.has(password.toLowerCase()) && (
                          <motion.p initial={{ opacity:0, y:-4 }} animate={{ opacity:1, y:0 }}
                            className="text-[10px] font-mono text-blood" role="alert">
                            This password appears on common breach lists.
                          </motion.p>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <div>
                  <label htmlFor="confirm-password" className="block text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-2">Confirm Password</label>
                  <div className="relative">
                    <input id="confirm-password" type="password" value={confirm}
                      onChange={e => setConfirm(e.target.value)} onFocus={playClick}
                      onKeyDown={e => { if (e.key==="Enter" && lockEngaged) goNext(); }}
                      placeholder="Type it again..." aria-describedby="confirm-match"
                      className="w-full bg-background/50 border border-border/50 rounded-xl px-5 py-4 text-base focus:outline-none focus:ring-2 focus:ring-foreground/20 focus:border-foreground/30 font-medium placeholder:text-muted-foreground/40 shadow-sm backdrop-blur-sm transition-colors duration-200 min-h-[52px]" />
                    <AnimatePresence>
                      {confirm.length > 0 && (
                        <motion.div id="confirm-match" initial={{ scale:0 }} animate={{ scale:1 }} exit={{ scale:0 }}
                          className={`absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center ${passwordsMatch ? "bg-sage/20 text-sage" : "bg-blood/20 text-blood"}`}
                          role="status" aria-label={passwordsMatch ? "Passwords match" : "Passwords do not match"}>
                          {passwordsMatch ? <Check className="w-3 h-3" aria-hidden="true" /> : <span className="text-xs font-bold" aria-hidden="true">x</span>}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <AnimatePresence>
                    {lockEngaged && (
                      <motion.div initial={{ opacity:0, y:-4 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }} className="flex items-center gap-1.5 mt-2">
                        <motion.div animate={{ scale:[1,1.35,1] }} transition={{ duration:0.4 }}>
                          <Shield className="w-3 h-3 text-sage" aria-hidden="true" />
                        </motion.div>
                        <span className="text-[10px] font-mono text-sage/80 uppercase tracking-wider">Access locked &amp; sealed</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>

              <motion.div custom={2} variants={fieldVariants} initial="hidden" animate="visible" className="flex items-center gap-3 mt-8 w-full max-w-sm">
                <button onClick={goBack} className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl border border-border/50 text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-all text-sm font-medium min-h-[52px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30" aria-label="Go back to Identity">
                  <ChevronLeft className="w-4 h-4" aria-hidden="true" /> Back
                </button>
                <button onClick={goNext} disabled={!passwordValid || !passwordsMatch}
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-foreground text-background font-semibold text-sm uppercase tracking-wider shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] disabled:opacity-30 disabled:pointer-events-none transition-all duration-300 min-h-[52px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/50"
                  aria-label="Continue to Optional step">
                  Continue <ChevronRight className="w-4 h-4" aria-hidden="true" />
                </button>
              </motion.div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="extras" custom={dir} variants={pageVars} initial="enter" animate="center" exit="exit"
              className="flex flex-col items-center pointer-events-auto touch-auto">
              <motion.div custom={0} variants={fieldVariants} initial="hidden" animate="visible" className="text-center mb-8">
                <div className="w-16 h-16 rounded-2xl bg-foreground/8 flex items-center justify-center mx-auto mb-6 border border-foreground/10">
                  <Fingerprint className="w-7 h-7 text-foreground/70" aria-hidden="true" />
                </div>
                <h2 className="font-serif text-3xl md:text-4xl tracking-tight text-foreground">Almost there</h2>
                <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">These are optional — you can skip and configure them later in settings.</p>
              </motion.div>

              <motion.div custom={1} variants={fieldVariants} initial="hidden" animate="visible" className="w-full max-w-sm space-y-4">
                <div className="p-5 rounded-2xl border border-border/50 bg-background/30 backdrop-blur-sm space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="relative w-10 h-10 rounded-xl bg-foreground/5 flex items-center justify-center cursor-pointer"
                      onMouseEnter={() => { setFpHover(true); setShowDemo(true); }}
                      onMouseLeave={() => { setFpHover(false); setShowDemo(false); }}
                      onFocus={() => { setFpHover(true); setShowDemo(true); }}
                      onBlur={() => { setFpHover(false); setShowDemo(false); }}
                      tabIndex={0} role="presentation">
                      {!isLowEnd && <FingerprintRipple active={fpHover} />}
                      <AnimatePresence mode="wait">
                        {passkeyDone ? (
                          <motion.div key="check" initial={{ scale:0, rotate:-90 }} animate={{ scale:1, rotate:0 }} transition={{ type:"spring", stiffness:400, damping:18 }}>
                            <Check className="w-5 h-5 text-sage" aria-hidden="true" />
                          </motion.div>
                        ) : (
                          <motion.div key="fp" initial={{ scale:1 }} exit={{ scale:0 }}>
                            <Fingerprint className="w-5 h-5 text-foreground/60" aria-hidden="true" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-foreground">Hardware Passkey</p>
                      <p className="text-[11px] text-muted-foreground">Biometric or security key</p>
                    </div>
                    <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/60 px-2 py-1 rounded-md bg-foreground/5">Optional</span>
                  </div>
                  <AnimatePresence>
                    {showPasskeyDemo && !passkeyDone && <PasskeyDemo show={showPasskeyDemo} />}
                  </AnimatePresence>
                  <button type="button" onClick={async () => {
                    playClick();
                    try {
                      // @ts-ignore
                      const { error } = await supabase.auth.registerPasskey();
                      if (error) throw error;
                      setPasskeyDone(true);
                      toast.success("Passkey registered successfully.");
                    } catch (err: any) {
                      toast.error(err.message || "Passkey registration failed. Try later in settings.");
                    }
                  }}
                    className="w-full py-2.5 rounded-xl border border-foreground/10 text-sm font-medium text-foreground/70 hover:text-foreground hover:border-foreground/25 hover:bg-foreground/5 transition-all min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30"
                    aria-label="Register a hardware passkey">
                    Register Passkey
                  </button>
                </div>
                <div>
                  <label htmlFor="phone" className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-1">
                    <Phone className="w-3 h-3" aria-hidden="true" />
                    Phone Number
                    <span className="text-muted-foreground/40 normal-case tracking-normal text-[10px]">(optional)</span>
                  </label>
                  <p className="text-[10px] text-muted-foreground/40 mb-2 font-mono">Unlocks grid alerts &amp; account recovery</p>
                  <input id="phone" type="tel" value={phone}
                    onChange={e => setPhone(formatPhone(e.target.value))} onFocus={playClick}
                    onKeyDown={e => { if (e.key==="Enter") handleFinish(); }}
                    placeholder="+1 (555) 000-0000" autoComplete="tel"
                    className="w-full bg-background/50 border border-border/50 rounded-xl px-5 py-4 text-base focus:outline-none focus:ring-2 focus:ring-foreground/20 focus:border-foreground/30 font-medium placeholder:text-muted-foreground/40 shadow-sm backdrop-blur-sm transition-colors duration-200 min-h-[52px]" />
                </div>
              </motion.div>

              <motion.div custom={2} variants={fieldVariants} initial="hidden" animate="visible" className="flex items-center gap-3 mt-8 w-full max-w-sm">
                <button onClick={goBack} className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl border border-border/50 text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-all text-sm font-medium min-h-[52px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30" aria-label="Go back to Security">
                  <ChevronLeft className="w-4 h-4" aria-hidden="true" /> Back
                </button>
                <button onClick={handleFinish} disabled={submitting}
                  className="flex-1 flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-foreground text-background font-semibold text-sm uppercase tracking-wider shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none transition-all duration-300 min-h-[52px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/50"
                  aria-label="Complete Setup">
                  {submitting
                    ? <><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Initializing...</>
                    : <><Sparkles className="w-4 h-4" aria-hidden="true" /> Complete Setup</>
                  }
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="absolute bottom-6 text-center z-10 flex flex-col items-center gap-2 pointer-events-auto touch-auto" aria-hidden="true">
        <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-muted-foreground/40">Secured by Obylon Grid &middot; Umbraxis</p>
        <button
          onClick={() => {
            const current = localStorage.getItem("OBYLON_FORCE_FLUID") === "true";
            localStorage.setItem("OBYLON_FORCE_FLUID", current ? "false" : "true");
            window.location.reload();
          }}
          className="font-mono text-[10px] uppercase tracking-wider text-[#666] hover:text-[#999] transition-colors focus:outline-none"
          style={{ background: 'none', border: 'none', padding: 0 }}
        >
          {typeof window !== 'undefined' && localStorage.getItem("OBYLON_FORCE_FLUID") === "true" 
            ? "[ SYS: OVERRIDE ENGAGED ]" 
            : "[ SYS: SAFE MODE ]"}
        </button>
      </div>

      <SuccessOverlay visible={isExiting} />

      <style>{`
        @keyframes scanlines {
          0% { background-position: 0 0; }
          100% { background-position: 0 4px; }
        }
      `}</style>
    </div>
  );
}
