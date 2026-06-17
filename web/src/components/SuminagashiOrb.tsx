import React, { useRef, useEffect, useCallback, useState } from "react";
import { createPortal } from "react-dom";

export interface SuminagashiOrbProps {}

export function useTypingVelocity(value: string): number {
  const historyRef = useRef<number[]>([]);
  const prevLenRef = useRef(value.length);
  const [velocity, setVelocity] = useState(0);

  useEffect(() => {
    if (value.length !== prevLenRef.current) {
      historyRef.current.push(Date.now());
      prevLenRef.current = value.length;
      const now = Date.now();
      historyRef.current = historyRef.current.filter(t => now - t < 2000);
      setVelocity(historyRef.current.length / 2);
    }
  }, [value]);

  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      historyRef.current = historyRef.current.filter(t => now - t < 2000);
      setVelocity(historyRef.current.length / 2);
    }, 500);
    return () => clearInterval(id);
  }, []);

  return velocity;
}

// FBO Types
interface FBO {
  texture: WebGLTexture;
  fbo: WebGLFramebuffer;
  width: number;
  height: number;
}

interface DoubleFBO {
  read: FBO;
  write: FBO;
  swap(): void;
}

interface Pointer {
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  down: boolean;
  color: [number, number, number];
}

// User's GLSL Shaders
const BASE_VERTEX_SHADER = `#version 300 es
precision highp float;
in vec2 aPosition;
out vec2 vUv;
out vec2 vL;
out vec2 vR;
out vec2 vT;
out vec2 vB;
uniform vec2 texelSize;
void main () {
  vUv = aPosition * 0.5 + 0.5;
  vL = vUv - vec2(texelSize.x, 0.0);
  vR = vUv + vec2(texelSize.x, 0.0);
  vT = vUv + vec2(0.0, texelSize.y);
  vB = vUv - vec2(0.0, texelSize.y);
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const SIMPLE_VERTEX_SHADER = `#version 300 es
precision highp float;
in vec2 aPosition;
out vec2 vUv;
void main () {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const SPLAT_SHADER = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTarget;
uniform float aspectRatio;
uniform vec3 color;
uniform vec2 point;
uniform float radius;
out vec4 fragColor;
void main () {
  vec2 p = vUv - point.xy;
  p.x *= aspectRatio;
  vec3 splat = exp(-dot(p, p) / radius) * color;
  vec3 base = texture(uTarget, vUv).xyz;
  fragColor = vec4(base + splat, 1.0);
}`;

const ADVECTION_SHADER = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform vec2 texelSize;
uniform vec2 dyeTexelSize;
uniform float dt;
uniform float dissipation;
out vec4 fragColor;

vec4 bilerp (sampler2D sam, vec2 uv, vec2 tsize) {
  vec2 st = uv / tsize - 0.5;
  vec2 iuv = floor(st);
  vec2 fuv = fract(st);
  vec4 a = texture(sam, (iuv + vec2(0.5, 0.5)) * tsize);
  vec4 b = texture(sam, (iuv + vec2(1.5, 0.5)) * tsize);
  vec4 c = texture(sam, (iuv + vec2(0.5, 1.5)) * tsize);
  vec4 d = texture(sam, (iuv + vec2(1.5, 1.5)) * tsize);
  return mix(mix(a, b, fuv.x), mix(c, d, fuv.x), fuv.y);
}

void main () {
  vec2 coord = vUv - dt * bilerp(uVelocity, vUv, texelSize).xy * texelSize;
  vec4 result = dissipation * bilerp(uSource, coord, dyeTexelSize);
  float decay = 1.0 + dissipation * dt;
  fragColor = result / decay;
}`;

const CURL_SHADER = `#version 300 es
precision highp float;
in vec2 vUv;
in vec2 vL;
in vec2 vR;
in vec2 vT;
in vec2 vB;
uniform sampler2D uVelocity;
out vec4 fragColor;
void main () {
  float L = texture(uVelocity, vL).y;
  float R = texture(uVelocity, vR).y;
  float T = texture(uVelocity, vT).x;
  float B = texture(uVelocity, vB).x;
  float vorticity = R - L - T + B;
  fragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);
}`;

const VORTICITY_SHADER = `#version 300 es
precision highp float;
in vec2 vUv;
in vec2 vL;
in vec2 vR;
in vec2 vT;
in vec2 vB;
uniform sampler2D uVelocity;
uniform sampler2D uCurl;
uniform float curl;
uniform float dt;
out vec4 fragColor;
void main () {
  float L = texture(uCurl, vL).x;
  float R = texture(uCurl, vR).x;
  float T = texture(uCurl, vT).x;
  float B = texture(uCurl, vB).x;
  float C = texture(uCurl, vUv).x;
  vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
  force /= length(force) + 0.0001;
  force *= curl * C;
  force.y *= -1.0;
  vec2 velocity = texture(uVelocity, vUv).xy;
  velocity += force * dt;
  velocity = min(max(velocity, -1000.0), 1000.0);
  fragColor = vec4(velocity, 0.0, 1.0);
}`;

const DIVERGENCE_SHADER = `#version 300 es
precision highp float;
in vec2 vUv;
in vec2 vL;
in vec2 vR;
in vec2 vT;
in vec2 vB;
uniform sampler2D uVelocity;
out vec4 fragColor;

vec2 sampleVelocity (sampler2D sam, vec2 uv) {
  vec2 multiplier = vec2(1.0, 1.0);
  if (uv.x < 0.0) { uv.x = 0.0; multiplier.x = -1.0; }
  if (uv.x > 1.0) { uv.x = 1.0; multiplier.x = -1.0; }
  if (uv.y < 0.0) { uv.y = 0.0; multiplier.y = -1.0; }
  if (uv.y > 1.0) { uv.y = 1.0; multiplier.y = -1.0; }
  return multiplier * texture(sam, uv).xy;
}

void main () {
  float L = sampleVelocity(uVelocity, vL).x;
  float R = sampleVelocity(uVelocity, vR).x;
  float T = sampleVelocity(uVelocity, vT).y;
  float B = sampleVelocity(uVelocity, vB).y;
  float div = 0.5 * (R - L + T - B);
  fragColor = vec4(div, 0.0, 0.0, 1.0);
}`;

const PRESSURE_SHADER = `#version 300 es
precision highp float;
in vec2 vUv;
in vec2 vL;
in vec2 vR;
in vec2 vT;
in vec2 vB;
uniform sampler2D uPressure;
uniform sampler2D uDivergence;
out vec4 fragColor;
void main () {
  float L = texture(uPressure, vL).x;
  float R = texture(uPressure, vR).x;
  float T = texture(uPressure, vT).x;
  float B = texture(uPressure, vB).x;
  float divergence = texture(uDivergence, vUv).x;
  float pressure = (L + R + B + T - divergence) * 0.25;
  fragColor = vec4(pressure, 0.0, 0.0, 1.0);
}`;

const GRADIENT_SUBTRACT_SHADER = `#version 300 es
precision highp float;
in vec2 vUv;
in vec2 vL;
in vec2 vR;
in vec2 vT;
in vec2 vB;
uniform sampler2D uPressure;
uniform sampler2D uVelocity;
out vec4 fragColor;
void main () {
  float L = texture(uPressure, vL).x;
  float R = texture(uPressure, vR).x;
  float T = texture(uPressure, vT).x;
  float B = texture(uPressure, vB).x;
  vec2 velocity = texture(uVelocity, vUv).xy;
  velocity.xy -= vec2(R - L, T - B);
  fragColor = vec4(velocity, 0.0, 1.0);
}`;

const DISPLAY_SHADER = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTexture;
uniform vec3 bgColor;
out vec4 fragColor;
void main () {
  vec3 color = texture(uTexture, vUv).rgb;
  // Tone-map: filmic-style soft clamp
  float lum = dot(color, vec3(0.299, 0.587, 0.114));
  vec3 mapped = color / (color + 1.0);
  // Blend with void-black background
  vec3 bg = bgColor;
  color = mix(bg, mapped, clamp(lum * 2.5, 0.0, 1.0));
  // Slight vignette
  vec2 uv = vUv * 2.0 - 1.0;
  float vig = 1.0 - dot(uv * 0.35, uv * 0.35);
  color *= clamp(vig, 0.0, 1.0);
  fragColor = vec4(color, 1.0);
}`;

function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error("Shader compile error: " + gl.getShaderInfoLog(shader));
  }
  return shader;
}

function createProgram(
  gl: WebGL2RenderingContext,
  vertSrc: string,
  fragSrc: string
): WebGLProgram {
  const vert = compileShader(gl, gl.VERTEX_SHADER, vertSrc);
  const frag = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc);
  const prog = gl.createProgram()!;
  gl.attachShader(prog, vert);
  gl.attachShader(prog, frag);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error("Program link error: " + gl.getProgramInfoLog(prog));
  }
  gl.deleteShader(vert);
  gl.deleteShader(frag);
  return prog;
}

function createFBO(
  gl: WebGL2RenderingContext,
  w: number,
  h: number,
  internalFormat: number,
  format: number,
  type: number,
  filter: number
): FBO {
  gl.activeTexture(gl.TEXTURE0);
  const texture = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null);

  const fbo = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  gl.viewport(0, 0, w, h);
  gl.clear(gl.COLOR_BUFFER_BIT);

  return { texture, fbo, width: w, height: h };
}

function createDoubleFBO(
  gl: WebGL2RenderingContext,
  w: number,
  h: number,
  internalFormat: number,
  format: number,
  type: number,
  filter: number
): DoubleFBO {
  let fbo1 = createFBO(gl, w, h, internalFormat, format, type, filter);
  let fbo2 = createFBO(gl, w, h, internalFormat, format, type, filter);
  return {
    get read() { return fbo1; },
    get write() { return fbo2; },
    swap() { [fbo1, fbo2] = [fbo2, fbo1]; },
  };
}

function bindFBO(gl: WebGL2RenderingContext, fbo: FBO | null) {
  if (fbo === null) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
  } else {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.fbo);
    gl.viewport(0, 0, fbo.width, fbo.height);
  }
}

function bindTexture(
  gl: WebGL2RenderingContext,
  unit: number,
  texture: WebGLTexture
) {
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, texture);
}

export const SuminagashiOrb: React.FC<SuminagashiOrbProps> = (props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    /* ── WebGL2 context ── */
    const gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
    }) as WebGL2RenderingContext;
    if (!gl) return;

    /* ── Extensions ── */
    const extHalfFloat = gl.getExtension("EXT_color_buffer_half_float");
    const extLinear    = gl.getExtension("OES_texture_half_float_linear");

    const halfFloatType = gl.HALF_FLOAT;
    const linearFilter = extLinear ? gl.LINEAR : gl.NEAREST;

    /* ── Sim config ── */
    const SIM_RES  = 256;
    const DYE_RES  = 512;
    const PRESSURE_ITERATIONS = 30;
    const CURL     = 28;
    const SPLAT_RADIUS = 0.0028;
    const VELOCITY_DISSIPATION = 0.18;
    const DENSITY_DISSIPATION  = 1.2;
    const DT = 0.016;

    /* ── Canvas resize ── */
    function resize() {
      const dpr = Math.min(window.devicePixelRatio, 2);
      canvas!.width  = Math.floor(window.innerWidth  * dpr);
      canvas!.height = Math.floor(window.innerHeight * dpr);
    }
    resize();
    window.addEventListener("resize", resize);

    /* ── Full-screen quad ── */
    const quadBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);

    /* ── Compile programs ── */
    const splatProg      = createProgram(gl, SIMPLE_VERTEX_SHADER, SPLAT_SHADER);
    const advectionProg  = createProgram(gl, SIMPLE_VERTEX_SHADER, ADVECTION_SHADER);
    const curlProg       = createProgram(gl, BASE_VERTEX_SHADER, CURL_SHADER);
    const vorticityProg  = createProgram(gl, BASE_VERTEX_SHADER, VORTICITY_SHADER);
    const divergenceProg = createProgram(gl, BASE_VERTEX_SHADER, DIVERGENCE_SHADER);
    const pressureProg   = createProgram(gl, BASE_VERTEX_SHADER, PRESSURE_SHADER);
    const gradSubProg    = createProgram(gl, BASE_VERTEX_SHADER, GRADIENT_SUBTRACT_SHADER);
    const displayProg    = createProgram(gl, SIMPLE_VERTEX_SHADER, DISPLAY_SHADER);

    function setupQuadAttribute(prog: WebGLProgram) {
      const loc = gl.getAttribLocation(prog, "aPosition");
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(loc);
    }

    /* ── FBO formats ── */
    const rgbaFmt = { internal: gl.RGBA16F,  fmt: gl.RGBA };
    const rgFmt   = { internal: gl.RG16F,    fmt: gl.RG   };
    const rFmt    = { internal: gl.R16F,     fmt: gl.RED  };

    /* ── Create FBOs ── */
    let velocity  = createDoubleFBO(gl, SIM_RES, SIM_RES, rgFmt.internal,  rgFmt.fmt,  halfFloatType, linearFilter);
    let dye       = createDoubleFBO(gl, DYE_RES, DYE_RES, rgbaFmt.internal, rgbaFmt.fmt, halfFloatType, linearFilter);
    let pressure  = createDoubleFBO(gl, SIM_RES, SIM_RES, rFmt.internal,   rFmt.fmt,   halfFloatType, gl.NEAREST);
    let divergence = createFBO(gl, SIM_RES, SIM_RES, rFmt.internal, rFmt.fmt, halfFloatType, gl.NEAREST);
    let curlFBO   = createFBO(gl, SIM_RES, SIM_RES, rFmt.internal, rFmt.fmt, halfFloatType, gl.NEAREST);

    /* ── Draw quad helper ── */
    function drawQuad() {
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    /* ── Splat ── */
    function splat(
      x: number, y: number,
      dx: number, dy: number,
      color: [number, number, number]
    ) {
      const aspect = canvas!.width / canvas!.height;
      const texW   = 1 / SIM_RES;
      const dyeW   = 1 / DYE_RES;

      gl.useProgram(splatProg);
      setupQuadAttribute(splatProg);
      bindFBO(gl, velocity.write);
      gl.uniform2f(gl.getUniformLocation(splatProg, "texelSize"), texW, texW);
      bindTexture(gl, 0, velocity.read.texture);
      gl.uniform1i(gl.getUniformLocation(splatProg, "uTarget"), 0);
      gl.uniform1f(gl.getUniformLocation(splatProg, "aspectRatio"), aspect);
      gl.uniform3f(gl.getUniformLocation(splatProg, "color"), dx, dy, 0);
      gl.uniform2f(gl.getUniformLocation(splatProg, "point"), x, y);
      gl.uniform1f(gl.getUniformLocation(splatProg, "radius"), SPLAT_RADIUS / aspect);
      drawQuad();
      velocity.swap();

      bindFBO(gl, dye.write);
      gl.uniform2f(gl.getUniformLocation(splatProg, "texelSize"), dyeW, dyeW);
      bindTexture(gl, 0, dye.read.texture);
      gl.uniform1i(gl.getUniformLocation(splatProg, "uTarget"), 0);
      gl.uniform1f(gl.getUniformLocation(splatProg, "aspectRatio"), aspect);
      gl.uniform3f(gl.getUniformLocation(splatProg, "color"), color[0] * 0.3, color[1] * 0.3, color[2] * 0.3);
      gl.uniform2f(gl.getUniformLocation(splatProg, "point"), x, y);
      gl.uniform1f(gl.getUniformLocation(splatProg, "radius"), SPLAT_RADIUS / aspect);
      drawQuad();
      dye.swap();
    }

    const pointers: Map<number, Pointer> = new Map();

    function onPointerDown(e: PointerEvent) {
      e.preventDefault();
      canvas!.setPointerCapture(e.pointerId);
      const x = e.clientX / window.innerWidth;
      const y = 1.0 - e.clientY / window.innerHeight;
      pointers.set(e.pointerId, { id: e.pointerId, x, y, dx: 0, dy: 0, down: true, color: [0.55, 0.08, 0.08] });
    }

    function onPointerMove(e: PointerEvent) {
      e.preventDefault();
      const ptr = pointers.get(e.pointerId);
      const x = e.clientX / window.innerWidth;
      const y = 1.0 - e.clientY / window.innerHeight;
      if (ptr) {
        ptr.dx = (x - ptr.x) * 8.0;
        ptr.dy = (y - ptr.y) * 8.0;
        ptr.x = x;
        ptr.y = y;
        if (ptr.down) {
          splat(ptr.x, ptr.y, ptr.dx * 5000, ptr.dy * 5000, ptr.color);
        }
      } else {
        pointers.set(e.pointerId, { id: e.pointerId, x, y, dx: 0, dy: 0, down: false, color: [0.55, 0.08, 0.08] });
      }
    }

    function onPointerUp(e: PointerEvent) {
      e.preventDefault();
      const ptr = pointers.get(e.pointerId);
      if (ptr) ptr.down = false;
    }

    function onPointerCancel(e: PointerEvent) {
      // Browser cancelled the pointer (e.g. scroll attempted) — mark up but keep
      // the entry so a subsequent pointerdown on the same touch can resume cleanly.
      const ptr = pointers.get(e.pointerId);
      if (ptr) ptr.down = false;
    }

    // Attach to the canvas element (not window) with passive:false so we can call
    // preventDefault() before the browser treats the drag as a scroll gesture.
    canvas!.addEventListener("pointerdown",   onPointerDown,   { passive: false });
    canvas!.addEventListener("pointermove",   onPointerMove,   { passive: false });
    canvas!.addEventListener("pointerup",     onPointerUp,     { passive: false });
    canvas!.addEventListener("pointercancel", onPointerCancel, { passive: false });

    // Prevent native touch scroll / pinch-zoom on the canvas layer
    const blockTouch = (e: TouchEvent) => e.preventDefault();
    canvas!.addEventListener("touchstart", blockTouch, { passive: false });
    canvas!.addEventListener("touchmove",  blockTouch, { passive: false });

    function step(dt: number) {
      const simTexelX = 1 / SIM_RES;
      const simTexelY = 1 / SIM_RES;
      const dyeTexelX = 1 / DYE_RES;
      const dyeTexelY = 1 / DYE_RES;

      gl.useProgram(curlProg);
      setupQuadAttribute(curlProg);
      gl.uniform2f(gl.getUniformLocation(curlProg, "texelSize"), simTexelX, simTexelY);
      bindTexture(gl, 0, velocity.read.texture);
      gl.uniform1i(gl.getUniformLocation(curlProg, "uVelocity"), 0);
      bindFBO(gl, curlFBO);
      drawQuad();

      gl.useProgram(vorticityProg);
      setupQuadAttribute(vorticityProg);
      gl.uniform2f(gl.getUniformLocation(vorticityProg, "texelSize"), simTexelX, simTexelY);
      bindTexture(gl, 0, velocity.read.texture);
      gl.uniform1i(gl.getUniformLocation(vorticityProg, "uVelocity"), 0);
      bindTexture(gl, 1, curlFBO.texture);
      gl.uniform1i(gl.getUniformLocation(vorticityProg, "uCurl"), 1);
      gl.uniform1f(gl.getUniformLocation(vorticityProg, "curl"), CURL);
      gl.uniform1f(gl.getUniformLocation(vorticityProg, "dt"), dt);
      bindFBO(gl, velocity.write);
      drawQuad();
      velocity.swap();

      gl.useProgram(divergenceProg);
      setupQuadAttribute(divergenceProg);
      gl.uniform2f(gl.getUniformLocation(divergenceProg, "texelSize"), simTexelX, simTexelY);
      bindTexture(gl, 0, velocity.read.texture);
      gl.uniform1i(gl.getUniformLocation(divergenceProg, "uVelocity"), 0);
      bindFBO(gl, divergence);
      drawQuad();

      bindFBO(gl, pressure.write);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      pressure.swap();

      gl.useProgram(pressureProg);
      setupQuadAttribute(pressureProg);
      gl.uniform2f(gl.getUniformLocation(pressureProg, "texelSize"), simTexelX, simTexelY);
      gl.uniform1i(gl.getUniformLocation(pressureProg, "uDivergence"), 1);
      bindTexture(gl, 1, divergence.texture);
      for (let i = 0; i < PRESSURE_ITERATIONS; i++) {
        bindTexture(gl, 0, pressure.read.texture);
        gl.uniform1i(gl.getUniformLocation(pressureProg, "uPressure"), 0);
        bindFBO(gl, pressure.write);
        drawQuad();
        pressure.swap();
      }

      gl.useProgram(gradSubProg);
      setupQuadAttribute(gradSubProg);
      gl.uniform2f(gl.getUniformLocation(gradSubProg, "texelSize"), simTexelX, simTexelY);
      bindTexture(gl, 0, pressure.read.texture);
      gl.uniform1i(gl.getUniformLocation(gradSubProg, "uPressure"), 0);
      bindTexture(gl, 1, velocity.read.texture);
      gl.uniform1i(gl.getUniformLocation(gradSubProg, "uVelocity"), 1);
      bindFBO(gl, velocity.write);
      drawQuad();
      velocity.swap();

      gl.useProgram(advectionProg);
      setupQuadAttribute(advectionProg);
      bindTexture(gl, 0, velocity.read.texture);
      gl.uniform1i(gl.getUniformLocation(advectionProg, "uVelocity"), 0);
      gl.uniform1i(gl.getUniformLocation(advectionProg, "uSource"), 0);
      gl.uniform2f(gl.getUniformLocation(advectionProg, "texelSize"), simTexelX, simTexelY);
      gl.uniform2f(gl.getUniformLocation(advectionProg, "dyeTexelSize"), simTexelX, simTexelY);
      gl.uniform1f(gl.getUniformLocation(advectionProg, "dt"), dt);
      gl.uniform1f(gl.getUniformLocation(advectionProg, "dissipation"), VELOCITY_DISSIPATION);
      bindFBO(gl, velocity.write);
      drawQuad();
      velocity.swap();

      bindTexture(gl, 0, velocity.read.texture);
      gl.uniform1i(gl.getUniformLocation(advectionProg, "uVelocity"), 0);
      bindTexture(gl, 1, dye.read.texture);
      gl.uniform1i(gl.getUniformLocation(advectionProg, "uSource"), 1);
      gl.uniform2f(gl.getUniformLocation(advectionProg, "texelSize"), simTexelX, simTexelY);
      gl.uniform2f(gl.getUniformLocation(advectionProg, "dyeTexelSize"), dyeTexelX, dyeTexelY);
      gl.uniform1f(gl.getUniformLocation(advectionProg, "dt"), dt);
      gl.uniform1f(gl.getUniformLocation(advectionProg, "dissipation"), DENSITY_DISSIPATION);
      bindFBO(gl, dye.write);
      drawQuad();
      dye.swap();
    }

    let rafId = 0;
    let lastTime = performance.now();

    function loop() {
      rafId = requestAnimationFrame(loop);

      const now = performance.now();
      const dt  = Math.min((now - lastTime) / 1000, 0.033);
      lastTime = now;

      step(DT);

      bindFBO(gl, null);
      gl.useProgram(displayProg);
      setupQuadAttribute(displayProg);
      bindTexture(gl, 0, dye.read.texture);
      gl.uniform1i(gl.getUniformLocation(displayProg, "uTexture"), 0);
      gl.uniform3f(gl.getUniformLocation(displayProg, "bgColor"), 0.015, 0.010, 0.018);
      drawQuad();
    }

    loop();

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      canvas!.removeEventListener("pointerdown",   onPointerDown);
      canvas!.removeEventListener("pointermove",   onPointerMove);
      canvas!.removeEventListener("pointerup",     onPointerUp);
      canvas!.removeEventListener("pointercancel", onPointerCancel);
      canvas!.removeEventListener("touchstart", blockTouch);
      canvas!.removeEventListener("touchmove",  blockTouch);
    };
  }, []);

  const canvasObj = <canvas ref={canvasRef} style={{
    position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 1,
    touchAction: 'none',
  }} />;

  return mounted ? createPortal(canvasObj, document.body) : null;
};
