// Jan Gango — landing
document.addEventListener('DOMContentLoaded', () => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- Fondos animados WebGL por bloque (sin dependencias) ----
  const beamsCanvas = document.querySelector('[data-fx="beams"]');
  const pillarCanvas = document.querySelector('[data-fx="pillar"]');
  if (beamsCanvas) initBeams(beamsCanvas, reduce);
  if (pillarCanvas) initPillar(pillarCanvas, reduce);

  // ---- ScrollStack: tarjetas que se apilan al hacer scroll ----
  const stack = document.querySelector('[data-scrollstack]');
  if (stack) initScrollStack(stack, reduce);

  // ---- Animaciones de scroll (entrada + salida) ----
  const blocks = document.querySelectorAll(
    '.hero-title, .hero-body, .hero-verdict, .cta-inline, ' +
    '.argument > *, .section-title, .card, .learn-foot, ' +
    '.signup-pitch, .signup-title, .form, .form-note, .ps'
  );

  blocks.forEach((el) => el.classList.add('reveal'));

  if (!reduce && 'IntersectionObserver' in window) {
    // Escalona los hijos dentro de un mismo contenedor
    document.querySelectorAll('.grid, .argument').forEach((group) => {
      [...group.children].forEach((child, i) => {
        if (child.classList.contains('reveal')) {
          child.style.setProperty('--d', `${i * 90}ms`);
        }
      });
    });

    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => e.target.classList.toggle('in', e.isIntersecting));
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });

    blocks.forEach((el) => io.observe(el));
  } else {
    // Sin soporte o movimiento reducido: mostrar todo
    blocks.forEach((el) => el.classList.add('in'));
  }

  // El formulario hace POST nativo a Keila (con hCaptcha). Sin JS que interceptar.
});

/* ============================================================
   Beams — fondo WebGL. Columnas de luz mostaza moduladas por
   ruido Perlin 3D (cnoise) que fluye hacia arriba con el tiempo.
   Port vanilla del componente React Bits <Beams />. Sin librerías.
   ============================================================ */
/* Compila + enlaza un programa; devuelve null si falla. */
function buildProgram(gl, vertSrc, fragSrc) {
  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn('shader:', gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  };
  const vs = compile(gl.VERTEX_SHADER, vertSrc);
  const fs = compile(gl.FRAGMENT_SHADER, fragSrc);
  if (!vs || !fs) return null;
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.warn('link:', gl.getProgramInfoLog(prog));
    return null;
  }
  return prog;
}

/* Triángulo a pantalla completa; deja el atributo `p` (vec2) listo. */
function fullscreenTriangle(gl, prog) {
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
}

function initBeams(canvas, reduce) {
  const gl = canvas.getContext('webgl', { antialias: true, alpha: false });
  if (!gl) { canvas.style.display = 'none'; return; }

  const vert = `
    attribute vec2 p;
    void main() { gl_Position = vec4(p, 0.0, 1.0); }
  `;

  const frag = `
    precision highp float;
    uniform vec2  uRes;
    uniform float uTime;
    uniform float uSpeed;
    uniform float uBeams;
    uniform float uNoise;
    uniform vec3  uGold;
    uniform vec3  uBg;

    // --- Perlin 3D (cnoise) — mismo del componente Beams ---
    vec4 permute(vec4 x){ return mod(((x*34.0)+1.0)*x, 289.0); }
    vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }
    vec3 fade(vec3 t){ return t*t*t*(t*(t*6.0-15.0)+10.0); }
    float cnoise(vec3 P){
      vec3 Pi0 = floor(P); vec3 Pi1 = Pi0 + vec3(1.0);
      Pi0 = mod(Pi0, 289.0); Pi1 = mod(Pi1, 289.0);
      vec3 Pf0 = fract(P); vec3 Pf1 = Pf0 - vec3(1.0);
      vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
      vec4 iy = vec4(Pi0.yy, Pi1.yy);
      vec4 iz0 = Pi0.zzzz; vec4 iz1 = Pi1.zzzz;
      vec4 ixy = permute(permute(ix) + iy);
      vec4 ixy0 = permute(ixy + iz0);
      vec4 ixy1 = permute(ixy + iz1);
      vec4 gx0 = ixy0 / 7.0;
      vec4 gy0 = fract(floor(gx0) / 7.0) - 0.5;
      gx0 = fract(gx0);
      vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
      vec4 sz0 = step(gz0, vec4(0.0));
      gx0 -= sz0 * (step(0.0, gx0) - 0.5);
      gy0 -= sz0 * (step(0.0, gy0) - 0.5);
      vec4 gx1 = ixy1 / 7.0;
      vec4 gy1 = fract(floor(gx1) / 7.0) - 0.5;
      gx1 = fract(gx1);
      vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
      vec4 sz1 = step(gz1, vec4(0.0));
      gx1 -= sz1 * (step(0.0, gx1) - 0.5);
      gy1 -= sz1 * (step(0.0, gy1) - 0.5);
      vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);
      vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
      vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);
      vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
      vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);
      vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
      vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);
      vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);
      vec4 norm0 = taylorInvSqrt(vec4(dot(g000,g000),dot(g010,g010),dot(g100,g100),dot(g110,g110)));
      g000 *= norm0.x; g010 *= norm0.y; g100 *= norm0.z; g110 *= norm0.w;
      vec4 norm1 = taylorInvSqrt(vec4(dot(g001,g001),dot(g011,g011),dot(g101,g101),dot(g111,g111)));
      g001 *= norm1.x; g011 *= norm1.y; g101 *= norm1.z; g111 *= norm1.w;
      float n000 = dot(g000, Pf0);
      float n100 = dot(g100, vec3(Pf1.x,Pf0.yz));
      float n010 = dot(g010, vec3(Pf0.x,Pf1.y,Pf0.z));
      float n110 = dot(g110, vec3(Pf1.xy,Pf0.z));
      float n001 = dot(g001, vec3(Pf0.xy,Pf1.z));
      float n101 = dot(g101, vec3(Pf1.x,Pf0.y,Pf1.z));
      float n011 = dot(g011, vec3(Pf0.x,Pf1.yz));
      float n111 = dot(g111, Pf1);
      vec3 fade_xyz = fade(Pf0);
      vec4 n_z = mix(vec4(n000,n100,n010,n110), vec4(n001,n101,n011,n111), fade_xyz.z);
      vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
      return 2.2 * mix(n_yz.x, n_yz.y, fade_xyz.x);
    }

    float rand(vec2 st){ return fract(sin(dot(st.xy, vec2(12.9898,78.233)))*43758.5453123); }

    void main(){
      vec2 uv = gl_FragCoord.xy / uRes.xy;
      float aspect = uRes.x / uRes.y;

      // leve inclinación diagonal de las columnas
      vec2 suv = uv;
      suv.x += (uv.y - 0.5) * 0.12;

      float t = uTime * uSpeed;
      float x = suv.x * uBeams * aspect;

      // forma de columna: brillo en el centro de cada beam
      float col = abs(fract(x) - 0.5) * 2.0;
      float beam = pow(1.0 - col, 2.5);

      // energía por columna, fluyendo hacia arriba
      float id = floor(x);
      float flow = cnoise(vec3(id * 0.7, suv.y * 1.6 - t, t * 0.35));
      float energy = smoothstep(-0.6, 0.9, flow);

      // capa fina extra de detalle
      float detail = 0.5 + 0.5 * cnoise(vec3(suv.x * 3.0, suv.y * 2.0 - t * 1.3, t * 0.2));

      float intensity = beam * energy * detail;

      // atenúa arriba y abajo
      intensity *= smoothstep(0.0, 0.25, uv.y) * smoothstep(1.0, 0.72, uv.y);

      // grano tipo noiseIntensity del original
      float grain = rand(gl_FragCoord.xy + t);
      intensity -= grain / 18.0 * uNoise;

      vec3 color = uBg + uGold * clamp(intensity, 0.0, 1.0) * 1.15;
      gl_FragColor = vec4(color, 1.0);
    }
  `;

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn('Beams shader:', gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  const vs = compile(gl.VERTEX_SHADER, vert);
  const fs = compile(gl.FRAGMENT_SHADER, frag);
  if (!vs || !fs) { canvas.style.display = 'none'; return; }

  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.useProgram(prog);

  // triángulo a pantalla completa
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const u = (name) => gl.getUniformLocation(prog, name);
  const uRes = u('uRes'), uTime = u('uTime');

  gl.uniform1f(u('uSpeed'), 0.28);
  gl.uniform1f(u('uBeams'), 11.0);
  gl.uniform1f(u('uNoise'), 1.75);
  gl.uniform3f(u('uGold'), 0.898, 0.882, 0.173); // #E5E12C
  gl.uniform3f(u('uBg'), 0.0, 0.0, 0.0);         // #000000

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.floor(canvas.clientWidth * dpr);
    const h = Math.floor(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
    gl.uniform2f(uRes, w, h);
  }

  let running = false;
  let visible = true;   // pestaña visible
  let onScreen = false; // canvas dentro del viewport
  const start = performance.now();

  resize();
  window.addEventListener('resize', resize, { passive: true });

  function render(now) {
    if (!running) return;
    gl.uniform1f(uTime, (now - start) / 1000);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    requestAnimationFrame(render);
  }

  if (reduce) {
    // Movimiento reducido: un solo frame estático
    gl.uniform1f(uTime, 8.0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    return;
  }

  function sync() {
    const shouldRun = visible && onScreen;
    if (shouldRun && !running) {
      running = true;
      requestAnimationFrame(render);
    } else if (!shouldRun) {
      running = false;
    }
  }

  // Pausa cuando la pestaña no está visible (ahorra batería/CPU)
  document.addEventListener('visibilitychange', () => {
    visible = !document.hidden;
    sync();
  });

  // Pausa cuando el canvas sale del viewport
  new IntersectionObserver((entries) => {
    onScreen = entries[0].isIntersecting;
    sync();
  }, { rootMargin: '100px' }).observe(canvas);
}

/* ============================================================
   ScrollStack — port vanilla (sin Lenis) del componente React
   Bits <ScrollStack />. Usa scroll nativo de ventana. Las cards
   se fijan y se apilan con escala decreciente al hacer scroll.
   ============================================================ */
function initScrollStack(container, reduce) {
  const cards = [...container.querySelectorAll('.scroll-stack-card')];
  const endEl = container.querySelector('.scroll-stack-end');
  if (!cards.length || !endEl) return;

  // Props (defaults del componente)
  const itemDistance = 100;
  const itemScale = 0.03;
  const itemStackDistance = 30;
  const stackPosition = '20%';
  const scaleEndPosition = '10%';
  const baseScale = 0.85;

  // Preparar cards
  cards.forEach((card, i) => {
    if (i < cards.length - 1) card.style.marginBottom = `${itemDistance}px`;
    card.style.transformOrigin = 'top center';
    card.style.willChange = 'transform';
    card.style.backfaceVisibility = 'hidden';
  });

  // Movimiento reducido: lista apilada normal, sin transformaciones
  if (reduce) return;

  const parsePct = (v, h) =>
    (typeof v === 'string' && v.includes('%')) ? (parseFloat(v) / 100) * h : parseFloat(v);
  const progress = (s, a, b) => (s < a ? 0 : s > b ? 1 : (s - a) / (b - a));

  let tops = [];
  let endTop = 0;

  // Medir posiciones base SIN transform (evita realimentación del getBoundingClientRect)
  function measure() {
    cards.forEach((c) => { c.style.transform = ''; });
    endEl.style.transform = '';
    const sy = window.scrollY;
    tops = cards.map((c) => c.getBoundingClientRect().top + sy);
    endTop = endEl.getBoundingClientRect().top + sy;
  }

  function update() {
    const scrollTop = window.scrollY;
    const vh = window.innerHeight;
    const stackPx = parsePct(stackPosition, vh);
    const scaleEndPx = parsePct(scaleEndPosition, vh);
    const pinEnd = endTop - vh / 2;

    cards.forEach((card, i) => {
      const cardTop = tops[i];
      const triggerStart = cardTop - stackPx - itemStackDistance * i;
      const triggerEnd = cardTop - scaleEndPx;
      const pinStart = triggerStart;

      const sp = progress(scrollTop, triggerStart, triggerEnd);
      const targetScale = baseScale + i * itemScale;
      const scale = 1 - sp * (1 - targetScale);

      let translateY = 0;
      if (scrollTop >= pinStart && scrollTop <= pinEnd) {
        translateY = scrollTop - cardTop + stackPx + itemStackDistance * i;
      } else if (scrollTop > pinEnd) {
        translateY = pinEnd - cardTop + stackPx + itemStackDistance * i;
      }

      card.style.transform =
        `translate3d(0, ${translateY.toFixed(2)}px, 0) scale(${scale.toFixed(4)})`;
    });
  }

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { update(); ticking = false; });
  }

  measure();
  update();

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => { measure(); update(); }, { passive: true });
  window.addEventListener('load', () => { measure(); update(); });
}

/* ============================================================
   LightPillar — pilar de luz raymarcheado. Port vanilla del
   componente React Bits <LightPillar />. Sin librerías.
   Calidad media fija; WebGL1 no tiene tanh() -> polyfill tanh3.
   ============================================================ */
function initPillar(canvas, reduce) {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: true, premultipliedAlpha: false });
  if (!gl) { canvas.style.display = 'none'; return; }

  const vert = `
    attribute vec2 p;
    varying vec2 vUv;
    void main() { vUv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }
  `;

  const frag = `
    precision highp float;
    uniform float uTime;
    uniform vec2  uResolution;
    uniform vec3  uTopColor;
    uniform vec3  uBottomColor;
    uniform float uIntensity;
    uniform float uGlowAmount;
    uniform float uPillarWidth;
    uniform float uPillarHeight;
    uniform float uNoiseIntensity;
    uniform float uRotCos;
    uniform float uRotSin;
    uniform float uPillarRotCos;
    uniform float uPillarRotSin;
    uniform float uWaveSin;
    uniform float uWaveCos;
    varying vec2 vUv;

    const float STEP_MULT = 1.2;
    const int   MAX_ITER  = 24;
    const int   WAVE_ITER = 2;

    // WebGL1 no trae tanh(): polyfill componentwise
    vec3 tanh3(vec3 x){ vec3 e = exp(-2.0 * x); return (1.0 - e) / (1.0 + e); }

    void main() {
      vec2 uv = (vUv * 2.0 - 1.0) * vec2(uResolution.x / uResolution.y, 1.0);
      uv = vec2(uPillarRotCos * uv.x - uPillarRotSin * uv.y,
                uPillarRotSin * uv.x + uPillarRotCos * uv.y);

      vec3 ro = vec3(0.0, 0.0, -10.0);
      vec3 rd = normalize(vec3(uv, 1.0));

      float rotC = uRotCos;
      float rotS = uRotSin;

      vec3 col = vec3(0.0);
      float t = 0.1;

      for (int i = 0; i < MAX_ITER; i++) {
        vec3 p = ro + rd * t;
        p.xz = vec2(rotC * p.x - rotS * p.z, rotS * p.x + rotC * p.z);

        vec3 q = p;
        q.y = p.y * uPillarHeight + uTime;

        float freq = 1.0;
        float amp = 1.0;
        for (int j = 0; j < WAVE_ITER; j++) {
          q.xz = vec2(uWaveCos * q.x - uWaveSin * q.z, uWaveSin * q.x + uWaveCos * q.z);
          q += cos(q.zxy * freq - uTime * float(j) * 2.0) * amp;
          freq *= 2.0;
          amp *= 0.5;
        }

        float d = length(cos(q.xz)) - 0.2;
        float bound = length(p.xz) - uPillarWidth;
        float k = 4.0;
        float h = max(k - abs(d - bound), 0.0);
        d = max(d, bound) + h * h * 0.0625 / k;
        d = abs(d) * 0.15 + 0.01;

        float grad = clamp((15.0 - p.y) / 30.0, 0.0, 1.0);
        col += mix(uBottomColor, uTopColor, grad) / d;

        t += d * STEP_MULT;
        if (t > 50.0) break;
      }

      float widthNorm = uPillarWidth / 3.0;
      col = tanh3(col * uGlowAmount / widthNorm);

      col -= fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) / 15.0 * uNoiseIntensity;

      col *= uIntensity;
      float a = clamp(max(col.r, max(col.g, col.b)), 0.0, 1.0);
      gl_FragColor = vec4(max(col, 0.0), a);
    }
  `;

  const prog = buildProgram(gl, vert, frag);
  if (!prog) { canvas.style.display = 'none'; return; }
  gl.useProgram(prog);
  fullscreenTriangle(gl, prog);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  const u = (n) => gl.getUniformLocation(prog, n);
  const uTime = u('uTime'), uRes = u('uResolution');
  const uRotCos = u('uRotCos'), uRotSin = u('uRotSin');

  // Props (paleta Thunder Lime — cambia uTopColor/uBottomColor para volver al morado/rosa original)
  gl.uniform3f(u('uTopColor'), 0.898, 0.882, 0.173);    // #E5E12C
  gl.uniform3f(u('uBottomColor'), 0.643, 0.635, 0.122); // #A4A21F
  gl.uniform1f(u('uIntensity'), 1.0);
  gl.uniform1f(u('uGlowAmount'), 0.005);
  gl.uniform1f(u('uPillarWidth'), 3.0);
  gl.uniform1f(u('uPillarHeight'), 0.4);
  gl.uniform1f(u('uNoiseIntensity'), 0.5);
  gl.uniform1f(u('uPillarRotCos'), 1.0);   // pillarRotation 0
  gl.uniform1f(u('uPillarRotSin'), 0.0);
  gl.uniform1f(u('uWaveSin'), Math.sin(0.4));
  gl.uniform1f(u('uWaveCos'), Math.cos(0.4));

  const rotationSpeed = 0.3;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.6);
    const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
    const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
    gl.uniform2f(uRes, w, h);
  }

  let running = false;
  let visible = true;
  let onScreen = false;
  let tAcc = 0;

  resize();
  window.addEventListener('resize', resize, { passive: true });

  function frame() {
    if (!running) return;
    tAcc += 0.016 * rotationSpeed;
    gl.uniform1f(uTime, tAcc);
    gl.uniform1f(uRotCos, Math.cos(tAcc * 0.3));
    gl.uniform1f(uRotSin, Math.sin(tAcc * 0.3));
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    requestAnimationFrame(frame);
  }

  if (reduce) {
    tAcc = 6.0;
    gl.uniform1f(uTime, tAcc);
    gl.uniform1f(uRotCos, Math.cos(tAcc * 0.3));
    gl.uniform1f(uRotSin, Math.sin(tAcc * 0.3));
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    return;
  }

  function sync() {
    const shouldRun = visible && onScreen;
    if (shouldRun && !running) {
      running = true;
      requestAnimationFrame(frame);
    } else if (!shouldRun) {
      running = false;
    }
  }

  document.addEventListener('visibilitychange', () => {
    visible = !document.hidden;
    sync();
  });

  new IntersectionObserver((entries) => {
    onScreen = entries[0].isIntersecting;
    sync();
  }, { rootMargin: '100px' }).observe(canvas);
}
