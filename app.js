/**
 * AgentAI / Evopixel Scroll-Driven Canvas Frame Renderer
 * Sincronização matemática da posição de rolagem (scrollY) com os 150 frames WebP
 */

document.addEventListener('DOMContentLoaded', () => {
  // Configuration
  const CONFIG = {
    totalFrames: 150,
    preloadCount: 25,
    framePrefix: 'public/frames/frame-',
    frameExtension: '.webp'
  };

  // State Management
  const state = {
    currentFrame: 1,
    targetFrame: 1,
    loadedCount: 0,
    isInitialBuffered: false,
    images: new Array(CONFIG.totalFrames).fill(null),
    animationFrameId: null
  };

  // DOM Elements
  const canvas = document.getElementById('hero-canvas');
  const ctx = canvas.getContext('2d');

  // Format frame index into 4-digit padded string: 1 -> "0001"
  function getFrameFilename(index) {
    const padded = String(index).padStart(4, '0');
    return `${CONFIG.framePrefix}${padded}${CONFIG.frameExtension}`;
  }

  // Handle Canvas Resize and High DPI / Retina Scaling
  function resizeCanvas() {
    const container = canvas.parentElement;
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Re-render current frame
    renderFrame(state.currentFrame);
  }

  // Render a specific frame on Canvas with 'cover' object-fit scaling
  function renderFrame(frameIndex) {
    const img = state.images[frameIndex - 1];
    if (!img || !img.complete) return;

    const container = canvas.parentElement;
    const canvasWidth = container.clientWidth || window.innerWidth;
    const canvasHeight = container.clientHeight || window.innerHeight;

    const imgWidth = img.naturalWidth || 1280;
    const imgHeight = img.naturalHeight || 720;

    // Calculate scale ratio to cover container while maintaining aspect ratio
    const scale = Math.max(canvasWidth / imgWidth, canvasHeight / imgHeight);
    const drawWidth = imgWidth * scale;
    const drawHeight = imgHeight * scale;

    const offsetX = (canvasWidth - drawWidth) / 2;
    const offsetY = (canvasHeight - drawHeight) / 2;

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
  }

  // Calculate target frame from current scroll position
  function updateScrollTarget() {
    const scrollY = window.scrollY || window.pageYOffset || 0;
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const scrollFraction = Math.max(0, Math.min(1, scrollY / maxScroll));

    // Map scroll percentage (0..1) to frame index (1..150)
    state.targetFrame = Math.floor(scrollFraction * (CONFIG.totalFrames - 1)) + 1;
  }

  // Load a single frame image asynchronously
  function loadFrameImage(index) {
    return new Promise((resolve) => {
      if (state.images[index - 1]) {
        return resolve(state.images[index - 1]);
      }

      const img = new Image();
      img.src = getFrameFilename(index);

      img.onload = () => {
        state.images[index - 1] = img;
        state.loadedCount++;
        checkBufferState();
        resolve(img);
      };

      img.onerror = () => {
        console.warn(`Falha ao carregar frame: ${getFrameFilename(index)}`);
        resolve(null);
      };
    });
  }

  // Check buffer status to trigger initial render
  function checkBufferState() {
    if (!state.isInitialBuffered && state.loadedCount >= CONFIG.preloadCount) {
      state.isInitialBuffered = true;
      updateScrollTarget();
      state.currentFrame = state.targetFrame;
      renderFrame(state.currentFrame);
    }
  }

  // Progressive Queue Loader: First load initial batch, then remaining in background
  async function initProgressiveLoading() {
    // Phase 1: Preload initial 25 frames
    const initialPromises = [];
    for (let i = 1; i <= CONFIG.preloadCount; i++) {
      initialPromises.push(loadFrameImage(i));
    }
    await Promise.all(initialPromises);

    // Phase 2: Lazy load remaining frames in small batches of 5
    const batchSize = 5;
    for (let i = CONFIG.preloadCount + 1; i <= CONFIG.totalFrames; i += batchSize) {
      const batchPromises = [];
      for (let j = i; j < i + batchSize && j <= CONFIG.totalFrames; j++) {
        batchPromises.push(loadFrameImage(j));
      }
      await Promise.all(batchPromises);
    }
  }

  // Smooth Render Loop using requestAnimationFrame + Lerp Interpolation
  function startRenderLoop() {
    function loop() {
      updateScrollTarget();

      // Lerp current frame towards target frame for ultra-smooth transition
      const diff = state.targetFrame - state.currentFrame;
      if (Math.abs(diff) > 0.05) {
        state.currentFrame += diff * 0.25; // 0.25 smooth lerp factor
        const frameToDraw = Math.round(state.currentFrame);
        renderFrame(frameToDraw);
      } else if (Math.round(state.currentFrame) !== state.targetFrame) {
        state.currentFrame = state.targetFrame;
        renderFrame(state.targetFrame);
      }

      state.animationFrameId = requestAnimationFrame(loop);
    }

    if (state.animationFrameId) {
      cancelAnimationFrame(state.animationFrameId);
    }
    state.animationFrameId = requestAnimationFrame(loop);
  }

  // OGL WebGL Shader Effect for Buttons
  function initOglButtons() {
    if (typeof window.OGL === 'undefined') {
      console.warn('OGL WebGL library not loaded.');
      return;
    }

    const { Renderer, Program, Mesh, Triangle } = window.OGL;
    const buttons = document.querySelectorAll('.btn, .btn-menu');

    // Shader GLSL Definitions
    const vertexShader = `
      attribute vec2 position;
      attribute vec2 uv;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `;

    const fragmentShader = `
      precision highp float;
      uniform float uTime;
      uniform vec2 uMouse;
      uniform float uHover;
      uniform vec3 uColor;
      varying vec2 vUv;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
          f.y
        );
      }

      void main() {
        vec2 st = vUv;
        vec2 distVec = st - uMouse;
        float dist = length(distVec);

        // Fluid liquid wave distortion
        float n = noise(st * 6.0 + uTime * 2.0);
        float wave = sin(st.x * 12.0 - uTime * 4.0 + n * 4.0) * 0.5 + 0.5;

        // Hover energy ring
        float ring = smoothstep(0.45, 0.0, dist) * uHover;
        float glow = wave * 0.35 + ring * 0.65;

        vec3 baseColor = mix(uColor, vec3(1.0, 0.3, 0.45), ring);
        float alpha = (glow * 0.85) * (0.15 + uHover * 0.85);

        gl_FragColor = vec4(baseColor, alpha);
      }
    `;

    buttons.forEach((button) => {
      // Create WebGL canvas for button
      const canvasEl = document.createElement('canvas');
      canvasEl.className = 'ogl-button-canvas';
      button.appendChild(canvasEl);

      const dpr = window.devicePixelRatio || 1;
      const renderer = new Renderer({
        canvas: canvasEl,
        alpha: true,
        dpr: Math.min(dpr, 2),
        premultipliedAlpha: false
      });

      const gl = renderer.gl;
      const geometry = new Triangle(gl);

      // Determine accent color (red vs dark)
      const isRed = button.classList.contains('btn-red-pill') || button.classList.contains('btn-red-full');
      const baseColor = isRed ? [1.0, 0.16, 0.23] : [0.35, 0.4, 0.5];

      const uniforms = {
        uTime: { value: 0 },
        uMouse: { value: [0.5, 0.5] },
        uHover: { value: 0 },
        uColor: { value: baseColor }
      };

      const program = new Program(gl, {
        vertex: vertexShader,
        fragment: fragmentShader,
        uniforms,
        transparent: true,
        depthTest: false
      });

      const mesh = new Mesh(gl, { geometry, program });

      let hoverTarget = 0;
      let mouseTarget = [0.5, 0.5];

      function resizeButtonCanvas() {
        const width = button.clientWidth;
        const height = button.clientHeight;
        if (width === 0 || height === 0) return;
        renderer.setSize(width, height);
      }

      resizeButtonCanvas();
      window.addEventListener('resize', resizeButtonCanvas);

      button.addEventListener('mouseenter', () => {
        hoverTarget = 1.0;
      });

      button.addEventListener('mouseleave', () => {
        hoverTarget = 0.0;
        mouseTarget = [0.5, 0.5];
      });

      button.addEventListener('mousemove', (e) => {
        const rect = button.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = 1.0 - (e.clientY - rect.top) / rect.height;
        mouseTarget = [x, y];
      });

      // Render loop per button
      function renderBtn(t) {
        uniforms.uTime.value = t * 0.0015;

        // Smooth Lerp hover and mouse
        uniforms.uHover.value += (hoverTarget - uniforms.uHover.value) * 0.1;
        uniforms.uMouse.value[0] += (mouseTarget[0] - uniforms.uMouse.value[0]) * 0.15;
        uniforms.uMouse.value[1] += (mouseTarget[1] - uniforms.uMouse.value[1]) * 0.15;

        renderer.render({ scene: mesh });
        requestAnimationFrame(renderBtn);
      }

      requestAnimationFrame(renderBtn);
    });
  }

  // FAQ Accordion Interactivity
  function initFaqAccordion() {
    const faqTriggers = document.querySelectorAll('.faq-trigger');
    
    faqTriggers.forEach((trigger) => {
      trigger.addEventListener('click', () => {
        const item = trigger.closest('.faq-item');
        const isOpen = item.classList.contains('active');

        // Close all other active items for clean single-accordion UX
        document.querySelectorAll('.faq-item.active').forEach((activeItem) => {
          if (activeItem !== item) {
            activeItem.classList.remove('active');
            const activeBtn = activeItem.querySelector('.faq-trigger');
            if (activeBtn) activeBtn.setAttribute('aria-expanded', 'false');
          }
        });

        // Toggle current item
        if (isOpen) {
          item.classList.remove('active');
          trigger.setAttribute('aria-expanded', 'false');
        } else {
          item.classList.add('active');
          trigger.setAttribute('aria-expanded', 'true');
        }
      });
    });
  }

  // React Bits BorderGlow Interactive Mouse Tracking
  function initBorderGlowEffect() {
    const cards = document.querySelectorAll('.glass-card, .metric-card, .stat-card-stacked, .service-card, .faq-item');

    cards.forEach((card) => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        card.style.setProperty('--glow-x', `${x.toFixed(1)}%`);
        card.style.setProperty('--glow-y', `${y.toFixed(1)}%`);
      });
    });
  }

  // Animated Count-Up for Key Metrics using IntersectionObserver and Eased Progress
  function initCountUpAnimation() {
    const countElements = document.querySelectorAll('.count-up');
    if (!countElements.length) return;

    function easeOutCubic(t) {
      return 1 - Math.pow(1 - t, 3);
    }

    function animateCount(el) {
      const target = parseFloat(el.getAttribute('data-target')) || 0;
      const suffix = el.getAttribute('data-suffix') || '';
      const prefix = el.getAttribute('data-prefix') || '';
      const duration = 1800;
      const startTime = performance.now();

      function update(now) {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / duration);
        const easedProgress = easeOutCubic(progress);
        const currentVal = Math.floor(easedProgress * target);

        el.textContent = `${prefix}${currentVal}${suffix}`;

        if (progress < 1) {
          requestAnimationFrame(update);
        } else {
          el.textContent = `${prefix}${target}${suffix}`;
        }
      }

      requestAnimationFrame(update);
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const el = entry.target;
          if (!el.classList.contains('counted')) {
            el.classList.add('counted');
            animateCount(el);
          }
        }
      });
    }, { threshold: 0.2 });

    countElements.forEach((el) => observer.observe(el));
  }

  // Event Listeners
  window.addEventListener('resize', () => {
    resizeCanvas();
    updateScrollTarget();
  });

  window.addEventListener('scroll', updateScrollTarget, { passive: true });

  // Initialize
  resizeCanvas();
  initProgressiveLoading();
  startRenderLoop();
  initFaqAccordion();
  initOglButtons();
  initBorderGlowEffect();
  initCountUpAnimation();
});




