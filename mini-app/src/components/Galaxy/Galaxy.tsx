import { useEffect, useRef, useState } from 'react';
import './Galaxy.css';

const vertexShader = `
attribute vec2 uv;
attribute vec2 position;

varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 0, 1);
}
`;

const fragmentShader = `
precision highp float;

uniform float uTime;
uniform vec3 uResolution;
uniform vec2 uFocal;
uniform vec2 uRotation;
uniform float uStarSpeed;
uniform float uDensity;
uniform float uHueShift;
uniform float uSpeed;
uniform vec2 uMouse;
uniform float uGlowIntensity;
uniform float uSaturation;
uniform bool uMouseRepulsion;
uniform float uTwinkleIntensity;
uniform float uRotationSpeed;
uniform float uRepulsionStrength;
uniform float uMouseActiveFactor;
uniform float uAutoCenterRepulsion;
uniform bool uTransparent;

varying vec2 vUv;

#define NUM_LAYER 4.0
#define STAR_COLOR_CUTOFF 0.2
#define MAT45 mat2(0.7071, -0.7071, 0.7071, 0.7071)
#define PERIOD 3.0

float Hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float tri(float x) {
  return abs(fract(x) * 2.0 - 1.0);
}

float tris(float x) {
  float t = fract(x);
  return 1.0 - smoothstep(0.0, 1.0, abs(2.0 * t - 1.0));
}

float trisn(float x) {
  float t = fract(x);
  return 2.0 * (1.0 - smoothstep(0.0, 1.0, abs(2.0 * t - 1.0))) - 1.0;
}

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

float Star(vec2 uv, float flare) {
  float d = length(uv);
  float m = (0.05 * uGlowIntensity) / d;
  float rays = smoothstep(0.0, 1.0, 1.0 - abs(uv.x * uv.y * 1000.0));
  m += rays * flare * uGlowIntensity;
  uv *= MAT45;
  rays = smoothstep(0.0, 1.0, 1.0 - abs(uv.x * uv.y * 1000.0));
  m += rays * 0.3 * flare * uGlowIntensity;
  m *= smoothstep(1.0, 0.2, d);
  return m;
}

vec3 StarLayer(vec2 uv) {
  vec3 col = vec3(0.0);

  vec2 gv = fract(uv) - 0.5;
  vec2 id = floor(uv);

  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 offset = vec2(float(x), float(y));
      vec2 si = id + vec2(float(x), float(y));
      float seed = Hash21(si);
      float size = fract(seed * 345.32);
      float glossLocal = tri(uStarSpeed / (PERIOD * seed + 1.0));
      float flareSize = smoothstep(0.9, 1.0, size) * glossLocal;

      float red = smoothstep(STAR_COLOR_CUTOFF, 1.0, Hash21(si + 1.0)) + STAR_COLOR_CUTOFF;
      float blu = smoothstep(STAR_COLOR_CUTOFF, 1.0, Hash21(si + 3.0)) + STAR_COLOR_CUTOFF;
      float grn = min(red, blu) * seed;
      vec3 base = vec3(red, grn, blu);

      float hue = atan(base.g - base.r, base.b - base.r) / (2.0 * 3.14159) + 0.5;
      hue = fract(hue + uHueShift / 360.0);
      float sat = length(base - vec3(dot(base, vec3(0.299, 0.587, 0.114)))) * uSaturation;
      float val = max(max(base.r, base.g), base.b);
      base = hsv2rgb(vec3(hue, sat, val));

      vec2 pad = vec2(tris(seed * 34.0 + uTime * uSpeed / 10.0), tris(seed * 38.0 + uTime * uSpeed / 30.0)) - 0.5;

      float star = Star(gv - offset - pad, flareSize);
      vec3 color = base;

      float twinkle = trisn(uTime * uSpeed + seed * 6.2831) * 0.5 + 1.0;
      twinkle = mix(1.0, twinkle, uTwinkleIntensity);
      star *= twinkle;

      col += star * size * color;
    }
  }

  return col;
}

void main() {
  vec2 focalPx = uFocal * uResolution.xy;
  vec2 uv = (vUv * uResolution.xy - focalPx) / uResolution.y;

  vec2 mouseNorm = uMouse - vec2(0.5);

  if (uAutoCenterRepulsion > 0.0) {
    vec2 centerUV = vec2(0.0, 0.0);
    float centerDist = length(uv - centerUV);
    vec2 repulsion = normalize(uv - centerUV) * (uAutoCenterRepulsion / (centerDist + 0.1));
    uv += repulsion * 0.05;
  } else if (uMouseRepulsion) {
    vec2 mousePosUV = (uMouse * uResolution.xy - focalPx) / uResolution.y;
    float mouseDist = length(uv - mousePosUV);
    vec2 repulsion = normalize(uv - mousePosUV) * (uRepulsionStrength / (mouseDist + 0.1));
    uv += repulsion * 0.05 * uMouseActiveFactor;
  } else {
    vec2 mouseOffset = mouseNorm * 0.1 * uMouseActiveFactor;
    uv += mouseOffset;
  }

  float autoRotAngle = uTime * uRotationSpeed;
  mat2 autoRot = mat2(cos(autoRotAngle), -sin(autoRotAngle), sin(autoRotAngle), cos(autoRotAngle));
  uv = autoRot * uv;

  uv = mat2(uRotation.x, -uRotation.y, uRotation.y, uRotation.x) * uv;

  vec3 col = vec3(0.0);

  for (float i = 0.0; i < 1.0; i += 1.0 / NUM_LAYER) {
    float depth = fract(i + uStarSpeed * uSpeed);
    float scale = mix(20.0 * uDensity, 0.5 * uDensity, depth);
    float fade = depth * smoothstep(1.0, 0.9, depth);
    col += StarLayer(uv * scale + i * 453.32) * fade;
  }

  if (uTransparent) {
    float alpha = length(col);
    alpha = smoothstep(0.0, 0.3, alpha);
    alpha = min(alpha, 1.0);
    gl_FragColor = vec4(col, alpha);
  } else {
    gl_FragColor = vec4(col, 1.0);
  }
}
`;

interface GalaxyProps {
  focal?: [number, number];
  rotation?: [number, number];
  starSpeed?: number;
  density?: number;
  hueShift?: number;
  disableAnimation?: boolean;
  maxFps?: number;
  resolutionScale?: number;
  speed?: number;
  mouseInteraction?: boolean;
  glowIntensity?: number;
  saturation?: number;
  mouseRepulsion?: boolean;
  twinkleIntensity?: number;
  rotationSpeed?: number;
  repulsionStrength?: number;
  autoCenterRepulsion?: number;
  transparent?: boolean;
}

function detectWebGLSupport(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return false;

    // Check for minimum capability: shader compilation
    const glCtx = gl as WebGLRenderingContext;
    const vs = glCtx.createShader(glCtx.VERTEX_SHADER);
    if (!vs) return false;
    glCtx.shaderSource(vs, 'void main(){ gl_Position = vec4(0); }');
    glCtx.compileShader(vs);
    const ok = glCtx.getShaderParameter(vs, glCtx.COMPILE_STATUS);
    glCtx.deleteShader(vs);
    glCtx.getExtension('WEBGL_lose_context')?.loseContext();

    return !!ok;
  } catch {
    return false;
  }
}

function detectLowPerformance(): boolean {
  // Rough heuristic: low core count or reported low memory
  const nav = navigator as any;
  if (nav.hardwareConcurrency && nav.hardwareConcurrency <= 2) return true;
  if (nav.deviceMemory && nav.deviceMemory <= 2) return true;
  return false;
}

const webglSupported = detectWebGLSupport();
const lowPerformance = detectLowPerformance();

export default function Galaxy({
  focal = [0.5, 0.5],
  rotation = [1.0, 0.0],
  starSpeed = 0.5,
  density = 1,
  hueShift = 140,
  disableAnimation = false,
  maxFps = 60,
  resolutionScale = 1,
  speed = 1.0,
  mouseInteraction = true,
  glowIntensity = 0.3,
  saturation = 0.0,
  mouseRepulsion = true,
  repulsionStrength = 2,
  twinkleIntensity = 0.3,
  rotationSpeed = 0.1,
  autoCenterRepulsion = 0,
  transparent = true,
}: GalaxyProps) {
  const ctnDom = useRef<HTMLDivElement>(null);
  const targetMousePos = useRef({ x: 0.5, y: 0.5 });
  const smoothMousePos = useRef({ x: 0.5, y: 0.5 });
  const targetMouseActive = useRef(0.0);
  const smoothMouseActive = useRef(0.0);
  const [useFallback, setUseFallback] = useState(!webglSupported || lowPerformance);

  useEffect(() => {
    if (useFallback) return;
    if (!ctnDom.current) return;

    const ctn = ctnDom.current;

    let Renderer: any, Program: any, Mesh: any, Color: any, Triangle: any;
    let destroyed = false;
    const cleanupRef = { current: () => { destroyed = true; } };

    (async () => {
      try {
        const ogl = await import('ogl');
        Renderer = ogl.Renderer;
        Program = ogl.Program;
        Mesh = ogl.Mesh;
        Color = ogl.Color;
        Triangle = ogl.Triangle;
      } catch {
        if (!destroyed) setUseFallback(true);
        return;
      }

      if (destroyed) return;

      let renderer: InstanceType<typeof Renderer>;
      try {
        renderer = new Renderer({
          alpha: transparent,
          premultipliedAlpha: false,
        });
      } catch {
        if (!destroyed) setUseFallback(true);
        return;
      }

      const gl = renderer.gl;

      if (transparent) {
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.clearColor(0, 0, 0, 0);
      } else {
        gl.clearColor(0, 0, 0, 1);
      }

      let program: InstanceType<typeof Program>;

      const effectiveScale = Math.max(0.3, Math.min(1, resolutionScale));

      function resize() {
        if (destroyed) return;
        renderer.setSize(
          ctn.offsetWidth * effectiveScale,
          ctn.offsetHeight * effectiveScale,
        );
        if (program) {
          program.uniforms.uResolution.value = new Color(
            gl.canvas.width,
            gl.canvas.height,
            gl.canvas.width / gl.canvas.height,
          );
        }
      }

      window.addEventListener('resize', resize, false);
      resize();

      const geometry = new Triangle(gl);

      try {
        program = new Program(gl, {
          vertex: vertexShader,
          fragment: fragmentShader,
          uniforms: {
            uTime: { value: 0 },
            uResolution: {
              value: new Color(
                gl.canvas.width,
                gl.canvas.height,
                gl.canvas.width / gl.canvas.height,
              ),
            },
            uFocal: { value: new Float32Array(focal) },
            uRotation: { value: new Float32Array(rotation) },
            uStarSpeed: { value: starSpeed },
            uDensity: { value: density },
            uHueShift: { value: hueShift },
            uSpeed: { value: speed },
            uMouse: {
              value: new Float32Array([
                smoothMousePos.current.x,
                smoothMousePos.current.y,
              ]),
            },
            uGlowIntensity: { value: glowIntensity },
            uSaturation: { value: saturation },
            uMouseRepulsion: { value: mouseRepulsion },
            uTwinkleIntensity: { value: twinkleIntensity },
            uRotationSpeed: { value: rotationSpeed },
            uRepulsionStrength: { value: repulsionStrength },
            uMouseActiveFactor: { value: 0.0 },
            uAutoCenterRepulsion: { value: autoCenterRepulsion },
            uTransparent: { value: transparent },
          },
        });
      } catch {
        // Shader compilation failed — fall back to CSS
        window.removeEventListener('resize', resize);
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        if (!destroyed) setUseFallback(true);
        return;
      }

      const mesh = new Mesh(gl, { geometry, program });
      let animateId: number;
      let lastRender = 0;
      const minFrameMs = maxFps > 0 ? 1000 / maxFps : 0;

      // FPS monitoring: switch to fallback if sustained low FPS
      let fpsFrameCount = 0;
      let fpsStartTime = 0;
      let lowFpsStreak = 0;
      const FPS_CHECK_INTERVAL = 2000;
      const LOW_FPS_THRESHOLD = 12;
      const LOW_FPS_STRIKES = 2;

      function update(t: number) {
        if (destroyed) return;
        animateId = requestAnimationFrame(update);

        if (minFrameMs > 0 && t - lastRender < minFrameMs) return;
        lastRender = t;

        // FPS monitoring
        fpsFrameCount++;
        if (fpsStartTime === 0) fpsStartTime = t;
        const elapsed = t - fpsStartTime;
        if (elapsed >= FPS_CHECK_INTERVAL) {
          const fps = (fpsFrameCount / elapsed) * 1000;
          if (fps < LOW_FPS_THRESHOLD) {
            lowFpsStreak++;
            if (lowFpsStreak >= LOW_FPS_STRIKES) {
              cancelAnimationFrame(animateId);
              window.removeEventListener('resize', resize);
              if (mouseInteraction) {
                ctn.removeEventListener('mousemove', handleMouseMove);
                ctn.removeEventListener('mouseleave', handleMouseLeave);
              }
              try { ctn.removeChild(gl.canvas); } catch {}
              gl.getExtension('WEBGL_lose_context')?.loseContext();
              if (!destroyed) setUseFallback(true);
              return;
            }
          } else {
            lowFpsStreak = 0;
          }
          fpsFrameCount = 0;
          fpsStartTime = t;
        }

        if (!disableAnimation) {
          program.uniforms.uTime.value = t * 0.001;
          program.uniforms.uStarSpeed.value = (t * 0.001 * starSpeed) / 10.0;
        }

        const lerpFactor = 0.05;
        smoothMousePos.current.x +=
          (targetMousePos.current.x - smoothMousePos.current.x) * lerpFactor;
        smoothMousePos.current.y +=
          (targetMousePos.current.y - smoothMousePos.current.y) * lerpFactor;

        smoothMouseActive.current +=
          (targetMouseActive.current - smoothMouseActive.current) * lerpFactor;

        program.uniforms.uMouse.value[0] = smoothMousePos.current.x;
        program.uniforms.uMouse.value[1] = smoothMousePos.current.y;
        program.uniforms.uMouseActiveFactor.value = smoothMouseActive.current;

        renderer.render({ scene: mesh });
      }

      animateId = requestAnimationFrame(update);
      ctn.appendChild(gl.canvas);

      function handleMouseMove(e: MouseEvent) {
        const rect = ctn.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = 1.0 - (e.clientY - rect.top) / rect.height;
        targetMousePos.current = { x, y };
        targetMouseActive.current = 1.0;
      }

      function handleMouseLeave() {
        targetMouseActive.current = 0.0;
      }

      if (mouseInteraction) {
        ctn.addEventListener('mousemove', handleMouseMove);
        ctn.addEventListener('mouseleave', handleMouseLeave);
      }

      // Store cleanup for the effect destructor
      cleanupRef.current = () => {
        destroyed = true;
        cancelAnimationFrame(animateId);
        window.removeEventListener('resize', resize);
        if (mouseInteraction) {
          ctn.removeEventListener('mousemove', handleMouseMove);
          ctn.removeEventListener('mouseleave', handleMouseLeave);
        }
        try { ctn.removeChild(gl.canvas); } catch {}
        gl.getExtension('WEBGL_lose_context')?.loseContext();
      };
    })();

    return () => {
      cleanupRef.current();
    };
  }, [
    useFallback,
    focal,
    rotation,
    starSpeed,
    density,
    hueShift,
    disableAnimation,
    maxFps,
    resolutionScale,
    speed,
    mouseInteraction,
    glowIntensity,
    saturation,
    mouseRepulsion,
    twinkleIntensity,
    rotationSpeed,
    repulsionStrength,
    autoCenterRepulsion,
    transparent,
  ]);

  if (useFallback) {
    return <div className="galaxy-fallback" aria-hidden />;
  }

  return <div ref={ctnDom} className="galaxy-container" aria-hidden />;
}
