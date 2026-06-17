import { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';
import * as THREE from 'three';

const config = {
  SIM_RES: 256,
  DYE_RES: 1280,
  PRESSURE_ITER: 32,
  VEL_DISSIPATION: 0.12,
  DYE_DISSIPATION: 0.055,
  CURL: 18,
  SPLAT_RADIUS: 0.0032,
  SPLAT_FORCE: 6000,
  SPLAT_DISSIPATION: 0.95,
  TIME_STEP: 0.016,
};

const INKS: Record<string, THREE.Color> = {
  sumi: new THREE.Color('#1a1a1f'),
  ai: new THREE.Color('#16407a'),
  shu: new THREE.Color('#c8372d'),
  matsuba: new THREE.Color('#2e6e52'),
};
const INK_KEYS = Object.keys(INKS);
const PAPER = new THREE.Color('#efeae0');

function inkAbsorption(c: THREE.Color, strength: number) {
  const e = 0.012;
  return new THREE.Vector3(
    -Math.log(Math.max(c.r, e)) * strength,
    -Math.log(Math.max(c.g, e)) * strength,
    -Math.log(Math.max(c.b, e)) * strength
  );
}

export interface SuminagashiHandle {
  dropInk: (x?: number, y?: number, color?: string) => void;
  wash: () => void;
  setColor: (colorKey: string) => void;
}

export const SuminagashiBackground = forwardRef<SuminagashiHandle, {}>((props, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({
    inkMode: 'cycle',
    inkCycleIdx: 0,
    pointer: { down: false, moved: false, x: 0, y: 0, px: 0, py: 0, color: INKS.sumi },
    lastInteraction: 0,
    autoFlow: true,
    nextDrop: 1200,
    nextStir: 2600,
    washing: 0,
    reducedMotion: typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false,
  });

  useImperativeHandle(ref, () => ({
    dropInk: (x?: number, y?: number, colorKey?: string) => {
      const c = colorKey && INKS[colorKey] ? INKS[colorKey] : INKS[INK_KEYS[Math.floor(Math.random() * INK_KEYS.length)]];
      if ((window as any).triggerInkDrop) {
        (window as any).triggerInkDrop(x ?? Math.random(), y ?? Math.random(), c, 0.8 + Math.random() * 0.7);
      }
    },
    wash: () => {
      stateRef.current.washing = 1.6;
    },
    setColor: (colorKey: string) => {
      stateRef.current.inkMode = colorKey;
    }
  }));

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, depth: false, stencil: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.autoClear = false;
    renderer.setClearColor(0xefeae0);

    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const scene = new THREE.Scene();
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    scene.add(quad);

    const computeSizes = () => {
      const aspect = window.innerWidth / window.innerHeight;
      const sim = config.SIM_RES;
      const dye = Math.min(config.DYE_RES, Math.max(window.innerWidth, window.innerHeight));
      return aspect >= 1
        ? { sw: Math.round(sim * aspect), sh: sim, dw: dye, dh: Math.round(dye / aspect) }
        : { sw: sim, sh: Math.round(sim / aspect), dw: Math.round(dye * aspect), dh: dye };
    };
    let S = computeSizes();

    const makeRT = (w: number, h: number) =>
      new THREE.WebGLRenderTarget(w, h, {
        minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
        wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping,
        format: THREE.RGBAFormat, type: THREE.HalfFloatType, depthBuffer: false,
      });

    const makeDoubleFBO = (w: number, h: number) => ({
      read: makeRT(w, h), write: makeRT(w, h),
      texel: new THREE.Vector2(1 / w, 1 / h),
      swap() { const t = this.read; this.read = this.write; this.write = t; },
      resize(nw: number, nh: number) {
        this.read.setSize(nw, nh); this.write.setSize(nw, nh);
        this.texel.set(1 / nw, 1 / nh);
      },
    });

    const velocity = makeDoubleFBO(S.sw, S.sh);
    const dye = makeDoubleFBO(S.dw, S.dh);
    const pressure = makeDoubleFBO(S.sw, S.sh);
    const curlRT = makeRT(S.sw, S.sh);
    const divergeRT = makeRT(S.sw, S.sh);

    const VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
    const prog = (frag: string, uniforms: Record<string, any>) =>
      new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false });

    const advectMat = prog(
      `precision highp float; varying vec2 vUv;
       uniform sampler2D uVelocity, uSource; uniform vec2 uTexel; uniform float uDt, uDissipation;
       void main(){ vec2 coord = vUv - uDt * texture2D(uVelocity, vUv).xy * uTexel;
         vec4 result = texture2D(uSource, coord); gl_FragColor = result / (1.0 + uDissipation * uDt); }`,
      { uVelocity:{value:null}, uSource:{value:null}, uTexel:{value:new THREE.Vector2()}, uDt:{value:0}, uDissipation:{value:0} }
    );
    const splatMat = prog(
      `precision highp float; varying vec2 vUv;
       uniform sampler2D uTarget; uniform float uAspect, uRadius; uniform vec2 uPoint; uniform vec3 uColor;
       void main(){ vec2 p = vUv - uPoint; p.x *= uAspect;
         vec3 splat = exp(-dot(p,p)/uRadius) * uColor;
         gl_FragColor = vec4(texture2D(uTarget, vUv).rgb + splat, 1.0); }`,
      { uTarget:{value:null}, uAspect:{value:1}, uRadius:{value:0.001}, uPoint:{value:new THREE.Vector2()}, uColor:{value:new THREE.Vector3()} }
    );
    const curlMat = prog(
      `precision highp float; varying vec2 vUv;
       uniform sampler2D uVelocity; uniform vec2 uTexel;
       void main(){ float L=texture2D(uVelocity,vUv-vec2(uTexel.x,0.0)).y, R=texture2D(uVelocity,vUv+vec2(uTexel.x,0.0)).y,
         B=texture2D(uVelocity,vUv-vec2(0.0,uTexel.y)).x, T=texture2D(uVelocity,vUv+vec2(0.0,uTexel.y)).x;
         gl_FragColor=vec4(0.5*(R-L-T+B),0.0,0.0,1.0); }`,
      { uVelocity:{value:null}, uTexel:{value:new THREE.Vector2()} }
    );
    const vorticityMat = prog(
      `precision highp float; varying vec2 vUv;
       uniform sampler2D uVelocity, uCurl; uniform vec2 uTexel; uniform float uCurlStrength, uDt;
       void main(){ float L=texture2D(uCurl,vUv-vec2(uTexel.x,0.0)).x, R=texture2D(uCurl,vUv+vec2(uTexel.x,0.0)).x,
         B=texture2D(uCurl,vUv-vec2(0.0,uTexel.y)).x, T=texture2D(uCurl,vUv+vec2(0.0,uTexel.y)).x, C=texture2D(uCurl,vUv).x;
         vec2 force=0.5*vec2(abs(T)-abs(B),abs(R)-abs(L)); force/=length(force)+0.0001;
         force*=uCurlStrength*C; force.y*=-1.0;
         vec2 vel=texture2D(uVelocity,vUv).xy+force*uDt; gl_FragColor=vec4(clamp(vel,-1000.0,1000.0),0.0,1.0); }`,
      { uVelocity:{value:null}, uCurl:{value:null}, uTexel:{value:new THREE.Vector2()}, uCurlStrength:{value:0}, uDt:{value:0} }
    );
    const divergeMat = prog(
      `precision highp float; varying vec2 vUv;
       uniform sampler2D uVelocity; uniform vec2 uTexel;
       void main(){ float L=texture2D(uVelocity,vUv-vec2(uTexel.x,0.0)).x, R=texture2D(uVelocity,vUv+vec2(uTexel.x,0.0)).x,
         B=texture2D(uVelocity,vUv-vec2(0.0,uTexel.y)).y, T=texture2D(uVelocity,vUv+vec2(0.0,uTexel.y)).y;
         vec2 C=texture2D(uVelocity,vUv).xy;
         if(vUv.x-uTexel.x<0.0)L=-C.x; if(vUv.x+uTexel.x>1.0)R=-C.x;
         if(vUv.y-uTexel.y<0.0)B=-C.y; if(vUv.y+uTexel.y>1.0)T=-C.y;
         gl_FragColor=vec4(0.5*(R-L+T-B),0.0,0.0,1.0); }`,
      { uVelocity:{value:null}, uTexel:{value:new THREE.Vector2()} }
    );
    const pressureMat = prog(
      `precision highp float; varying vec2 vUv;
       uniform sampler2D uPressure, uDivergence; uniform vec2 uTexel;
       void main(){ float L=texture2D(uPressure,vUv-vec2(uTexel.x,0.0)).x, R=texture2D(uPressure,vUv+vec2(uTexel.x,0.0)).x,
         B=texture2D(uPressure,vUv-vec2(0.0,uTexel.y)).x, T=texture2D(uPressure,vUv+vec2(0.0,uTexel.y)).x,
         div=texture2D(uDivergence,vUv).x;
         gl_FragColor=vec4((L+R+B+T-div)*0.25,0.0,0.0,1.0); }`,
      { uPressure:{value:null}, uDivergence:{value:null}, uTexel:{value:new THREE.Vector2()} }
    );
    const gradientMat = prog(
      `precision highp float; varying vec2 vUv;
       uniform sampler2D uPressure, uVelocity; uniform vec2 uTexel;
       void main(){ float L=texture2D(uPressure,vUv-vec2(uTexel.x,0.0)).x, R=texture2D(uPressure,vUv+vec2(uTexel.x,0.0)).x,
         B=texture2D(uPressure,vUv-vec2(0.0,uTexel.y)).x, T=texture2D(uPressure,vUv+vec2(0.0,uTexel.y)).x;
         vec2 vel=texture2D(uVelocity,vUv).xy-vec2(R-L,T-B);
         gl_FragColor=vec4(vel,0.0,1.0); }`,
      { uPressure:{value:null}, uVelocity:{value:null}, uTexel:{value:new THREE.Vector2()} }
    );
    const clearMat = prog(
      `precision highp float; varying vec2 vUv; uniform sampler2D uTexture; uniform float uValue;
       void main(){ gl_FragColor=uValue*texture2D(uTexture,vUv); }`,
      { uTexture:{value:null}, uValue:{value:0.8} }
    );
    const displayMat = prog(
      `precision highp float; varying vec2 vUv;
       uniform sampler2D uDye; uniform vec2 uTexel; vec3 uPaper=vec3(0.937,0.917,0.878); uniform float uTime;
       float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
       float noise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);
         return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y); }
       void main(){ float fiber=noise(vUv*420.0)*0.028+noise(vUv*180.0)*0.022+noise(vUv*60.0)*0.018;
         vec3 A=texture2D(uDye,vUv).rgb; vec3 col=uPaper*exp(-A)+fiber;
         vec2 uv2=vUv*(1.0-vUv.yx); float vign=pow(uv2.x*uv2.y*15.0,0.18);
         col*=0.92+0.08*vign; gl_FragColor=vec4(clamp(col,0.0,1.0),1.0); }`,
      { uDye:{value:null}, uTexel:{value:new THREE.Vector2()}, uTime:{value:0} }
    );

    const blit = (mat: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) => {
      quad.material = mat; renderer.setRenderTarget(target); renderer.render(scene, camera);
    };

    const splatVelocity = (x: number, y: number, fx: number, fy: number, rm?: number) => {
      splatMat.uniforms.uTarget.value = velocity.read.texture;
      splatMat.uniforms.uAspect.value = window.innerWidth / window.innerHeight;
      splatMat.uniforms.uPoint.value.set(x, y);
      splatMat.uniforms.uRadius.value = config.SPLAT_RADIUS * (rm || 1);
      splatMat.uniforms.uColor.value.set(fx, fy, 0);
      blit(splatMat, velocity.write); velocity.swap();
    };
    const splatDye = (x: number, y: number, abs: THREE.Vector3, rm?: number) => {
      splatMat.uniforms.uTarget.value = dye.read.texture;
      splatMat.uniforms.uAspect.value = window.innerWidth / window.innerHeight;
      splatMat.uniforms.uPoint.value.set(x, y);
      splatMat.uniforms.uRadius.value = config.SPLAT_RADIUS * (rm || 1);
      splatMat.uniforms.uColor.value.copy(abs);
      blit(splatMat, dye.write); dye.swap();
    };
    const dropInk = (x: number, y: number, color: THREE.Color, strength: number) => {
      const abs = inkAbsorption(color, strength * 0.22);
      splatDye(x, y, abs, 1.0);
      const angle = Math.random() * Math.PI * 2, speed = 60 + Math.random() * 80;
      splatVelocity(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, 1.2);
    };
    (window as any).triggerInkDrop = dropInk;
    const currentInkColor = (advance = false): THREE.Color => {
      if (stateRef.current.inkMode === 'cycle') {
        const c = INKS[INK_KEYS[stateRef.current.inkCycleIdx % INK_KEYS.length]];
        if (advance) stateRef.current.inkCycleIdx++;
        return c;
      }
      return INKS[stateRef.current.inkMode as keyof typeof INKS] || INKS.sumi;
    };
    const toUV = (e: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      return { x: (e.clientX - r.left) / r.width, y: 1 - (e.clientY - r.top) / r.height };
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (e.target && ['BUTTON', 'INPUT'].includes((e.target as HTMLElement).tagName)) return;
      const p = toUV(e);
      stateRef.current.pointer = { ...stateRef.current.pointer, down: true, x: p.x, y: p.y, px: p.x, py: p.y, color: currentInkColor(true) };
      dropInk(p.x, p.y, stateRef.current.pointer.color, 0.8 + Math.random() * 0.4);
      stateRef.current.lastInteraction = performance.now();
    };
    const handlePointerMove = (e: PointerEvent) => {
      const p = toUV(e);
      stateRef.current.pointer.px = stateRef.current.pointer.x;
      stateRef.current.pointer.py = stateRef.current.pointer.y;
      stateRef.current.pointer.x = p.x; stateRef.current.pointer.y = p.y;
      stateRef.current.pointer.moved = true;
      stateRef.current.lastInteraction = performance.now();
    };
    const handlePointerUp = () => { stateRef.current.pointer.down = false; };
    
    window.addEventListener('pointerdown', handlePointerDown, { passive: true });
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerup', handlePointerUp, { passive: true });
    window.addEventListener('pointercancel', handlePointerUp, { passive: true });

    const applyPointer = () => {
      if (!stateRef.current.pointer.moved) return;
      stateRef.current.pointer.moved = false;
      const dx = stateRef.current.pointer.x - stateRef.current.pointer.px;
      const dy = stateRef.current.pointer.y - stateRef.current.pointer.py;
      if (Math.abs(dx) + Math.abs(dy) < 1e-6) return;
      splatVelocity(stateRef.current.pointer.x, stateRef.current.pointer.y, dx * config.SPLAT_FORCE, dy * config.SPLAT_FORCE, stateRef.current.pointer.down ? 2.0 : 1.4);
      if (stateRef.current.pointer.down) {
        const speed = Math.min(Math.hypot(dx, dy) * 30, 1);
        splatDye(stateRef.current.pointer.x, stateRef.current.pointer.y, inkAbsorption(stateRef.current.pointer.color, 0.06 + speed * 0.12), 0.9);
      }
    };

    const autoUpdate = (now: number, dt: number) => {
      if (!stateRef.current.autoFlow) return;
      const idle = now - stateRef.current.lastInteraction > 3000;
      stateRef.current.nextDrop -= dt * 1000;
      if (idle && stateRef.current.nextDrop <= 0) {
        const x = 0.14 + Math.random() * 0.72, y = 0.16 + Math.random() * 0.68;
        const c = INKS[INK_KEYS[Math.floor(Math.random() * INK_KEYS.length)]];
        dropInk(x, y, c, 0.8 + Math.random() * 0.7);
        if (Math.random() < 0.3) {
          const c2 = INKS[INK_KEYS[Math.floor(Math.random() * INK_KEYS.length)]];
          const x2 = Math.min(Math.max(x + (Math.random() - 0.5) * 0.16, 0.08), 0.92);
          const y2 = Math.min(Math.max(y + (Math.random() - 0.5) * 0.16, 0.08), 0.92);
          setTimeout(() => dropInk(x2, y2, c2, 0.5 + Math.random() * 0.4), 220 + Math.random() * 300);
        }
        stateRef.current.nextDrop = (stateRef.current.reducedMotion ? 6500 : 2600) + Math.random() * 2600;
      }
      stateRef.current.nextStir -= dt * 1000;
      if (!stateRef.current.reducedMotion && stateRef.current.nextStir <= 0) {
        const tv = now * 0.00012, cx = 0.5 + Math.sin(tv * 1.7) * 0.3, cy = 0.5 + Math.cos(tv * 1.1) * 0.3;
        const a = tv * 6.0 + Math.random() * 1.5;
        splatVelocity(cx, cy, Math.cos(a) * 130, Math.sin(a) * 130, 14);
        stateRef.current.nextStir = 700 + Math.random() * 900;
      }
    };

    const step = (dt: number) => {
      curlMat.uniforms.uVelocity.value = velocity.read.texture;
      curlMat.uniforms.uTexel.value.copy(velocity.texel); blit(curlMat, curlRT);
      vorticityMat.uniforms.uVelocity.value = velocity.read.texture;
      vorticityMat.uniforms.uCurl.value = curlRT.texture;
      vorticityMat.uniforms.uTexel.value.copy(velocity.texel);
      vorticityMat.uniforms.uCurlStrength.value = config.CURL;
      vorticityMat.uniforms.uDt.value = dt;
      blit(vorticityMat, velocity.write); velocity.swap();
      divergeMat.uniforms.uVelocity.value = velocity.read.texture;
      divergeMat.uniforms.uTexel.value.copy(velocity.texel); blit(divergeMat, divergeRT);
      clearMat.uniforms.uTexture.value = pressure.read.texture;
      clearMat.uniforms.uValue.value = 0.8;
      blit(clearMat, pressure.write); pressure.swap();
      pressureMat.uniforms.uDivergence.value = divergeRT.texture;
      pressureMat.uniforms.uTexel.value.copy(velocity.texel);
      for (let i = 0; i < config.PRESSURE_ITER; i++) {
        pressureMat.uniforms.uPressure.value = pressure.read.texture;
        blit(pressureMat, pressure.write); pressure.swap();
      }
      gradientMat.uniforms.uPressure.value = pressure.read.texture;
      gradientMat.uniforms.uVelocity.value = velocity.read.texture;
      gradientMat.uniforms.uTexel.value.copy(velocity.texel);
      blit(gradientMat, velocity.write); velocity.swap();
      advectMat.uniforms.uVelocity.value = velocity.read.texture;
      advectMat.uniforms.uSource.value = velocity.read.texture;
      advectMat.uniforms.uTexel.value.copy(velocity.texel);
      advectMat.uniforms.uDt.value = dt;
      advectMat.uniforms.uDissipation.value = config.VEL_DISSIPATION;
      blit(advectMat, velocity.write); velocity.swap();
      const dyeDis = config.DYE_DISSIPATION + (stateRef.current.washing > 0 ? 2.4 : 0);
      advectMat.uniforms.uVelocity.value = velocity.read.texture;
      advectMat.uniforms.uSource.value = dye.read.texture;
      advectMat.uniforms.uTexel.value.copy(dye.texel);
      advectMat.uniforms.uDissipation.value = dyeDis;
      blit(advectMat, dye.write); dye.swap();
      if (stateRef.current.washing > 0) stateRef.current.washing -= dt;
    };

    let lastT = performance.now(), animationId: number;
    const animate = (now: number) => {
      animationId = requestAnimationFrame(animate);
      let dt = (now - lastT) / 1000; lastT = now;
      dt = Math.min(dt, 1 / 30); if (dt <= 0) return;
      applyPointer(); autoUpdate(now, dt); step(dt);
      displayMat.uniforms.uDye.value = dye.read.texture;
      displayMat.uniforms.uTime.value = now * 0.001;
      blit(displayMat, null);
    };

    setTimeout(() => dropInk(0.38, 0.58, INKS.sumi, 0.75), 100);
    setTimeout(() => dropInk(0.62, 0.42, INKS.ai, 0.6), 550);
    setTimeout(() => dropInk(0.5, 0.62, INKS.shu, 0.5), 1050);
    animate(performance.now());

    const handleResize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      S = computeSizes();
      velocity.resize(S.sw, S.sh); pressure.resize(S.sw, S.sh);
      curlRT.setSize(S.sw, S.sh); divergeRT.setSize(S.sw, S.sh); dye.resize(S.dw, S.dh);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      cancelAnimationFrame(animationId);
      renderer.dispose();
      delete (window as any).triggerInkDrop;
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full cursor-crosshair z-0"
      style={{ touchAction: 'none', display: 'block', pointerEvents: 'auto' }}
    />
  );
});
