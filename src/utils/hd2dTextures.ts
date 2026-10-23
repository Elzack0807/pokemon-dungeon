import * as THREE from 'three';

// Detect software WebGL per Three.js skill instructions
export const isSoftwareGl = (() => {
  if (typeof document === 'undefined') return true;
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
})();

/**
 * Procedural flagstone dungeon floor texture with stone brick patterns,
 * moss accents, and subtle bevels for authentic HD-2D aesthetics.
 */
export function createStoneFloorTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Base dark stone tone
  ctx.fillStyle = '#1e2430';
  ctx.fillRect(0, 0, 512, 512);

  // Stone tile grid
  const cols = 8;
  const rows = 8;
  const cellW = 512 / cols;
  const cellH = 512 / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * cellW + 2;
      const y = r * cellH + 2;
      const w = cellW - 4;
      const h = cellH - 4;

      // Deterministic stone color variation
      const seed = (r * 13 + c * 29) % 30;
      const lightness = 22 + (seed % 10);
      const isMossy = (r + c * 3) % 7 === 0;

      ctx.fillStyle = isMossy
        ? `hsl(145, 18%, ${lightness}%)`
        : `hsl(215, 14%, ${lightness}%)`;
      ctx.fillRect(x, y, w, h);

      // Stone highlight and inner shadow
      ctx.strokeStyle = `rgba(255, 255, 255, 0.08)`;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);

      ctx.strokeStyle = `rgba(0, 0, 0, 0.4)`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + w, y);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x, y + h);
      ctx.stroke();

      // Subtle cracks / stone noise
      if ((r + c) % 3 === 0) {
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.beginPath();
        ctx.moveTo(x + w * 0.3, y + h * 0.2);
        ctx.lineTo(x + w * 0.5, y + h * 0.6);
        ctx.lineTo(x + w * 0.7, y + h * 0.5);
        ctx.stroke();
      }
    }
  }

  // Deep mortar lines
  ctx.strokeStyle = '#0c0f16';
  ctx.lineWidth = 4;
  for (let i = 0; i <= cols; i++) {
    ctx.beginPath();
    ctx.moveTo(i * cellW, 0);
    ctx.lineTo(i * cellW, 512);
    ctx.stroke();
  }
  for (let j = 0; j <= rows; j++) {
    ctx.beginPath();
    ctx.moveTo(0, j * cellH);
    ctx.lineTo(512, j * cellH);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/**
 * Procedural dungeon stone wall texture with extruded ashlar blocks.
 */
export function createStoneWallTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#141822';
  ctx.fillRect(0, 0, 512, 512);

  const rows = 12;
  const rowH = 512 / rows;

  for (let r = 0; r < rows; r++) {
    const isOdd = r % 2 === 1;
    const blockCount = 6;
    const blockW = 512 / blockCount;
    const offset = isOdd ? blockW / 2 : 0;

    for (let b = -1; b <= blockCount + 1; b++) {
      const x = b * blockW + offset + 2;
      const y = r * rowH + 2;
      const w = blockW - 4;
      const h = rowH - 4;

      const seed = (r * 7 + b * 17) % 20;
      const shade = 18 + seed;
      ctx.fillStyle = `hsl(220, 16%, ${shade}%)`;
      ctx.fillRect(x, y, w, h);

      // Top bevel
      ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
      ctx.fillRect(x, y, w, 2);

      // Bottom shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fillRect(x, y + h - 2, w, 2);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/**
 * Procedural Battle Platform Magic Rune Disc texture.
 */
export function createBattlePedestalTexture(accentColor: string = '#38bdf8'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, 512, 512);

  // Outer stone ring
  const center = 256;
  const radius = 230;

  // Solid dark stone base
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.fillStyle = '#1c2230';
  ctx.fill();
  ctx.lineWidth = 14;
  ctx.strokeStyle = '#2d3748';
  ctx.stroke();

  // Glowing rune ring
  ctx.beginPath();
  ctx.arc(center, center, radius - 20, 0, Math.PI * 2);
  ctx.lineWidth = 4;
  ctx.strokeStyle = accentColor;
  ctx.shadowColor = accentColor;
  ctx.shadowBlur = 18;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Pokéball inner stylized circle
  ctx.beginPath();
  ctx.arc(center, center, 140, 0, Math.PI * 2);
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.stroke();

  // Central circle
  ctx.beginPath();
  ctx.arc(center, center, 45, 0, Math.PI * 2);
  ctx.fillStyle = '#0f172a';
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = accentColor;
  ctx.stroke();

  // Center button
  ctx.beginPath();
  ctx.arc(center, center, 20, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  // Radial rune notches
  for (let i = 0; i < 12; i++) {
    const angle = (i * Math.PI) / 6;
    const r1 = radius - 45;
    const r2 = radius - 25;
    ctx.beginPath();
    ctx.moveTo(center + Math.cos(angle) * r1, center + Math.sin(angle) * r1);
    ctx.lineTo(center + Math.cos(angle) * r2, center + Math.sin(angle) * r2);
    ctx.lineWidth = 4;
    ctx.strokeStyle = accentColor;
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Procedural Contact Shadow Grounding Texture.
 */
export function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  const gradient = ctx.createRadialGradient(64, 64, 10, 64, 64, 60);
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0.7)');
  gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.35)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Procedural Flame Billboard Texture for Torches.
 */
export function createTorchFlameTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, 64, 128);

  const gradient = ctx.createRadialGradient(32, 90, 4, 32, 70, 32);
  gradient.addColorStop(0, '#ffffff');
  gradient.addColorStop(0.2, '#ffdd55');
  gradient.addColorStop(0.6, '#ff6600');
  gradient.addColorStop(0.9, '#dd2200');
  gradient.addColorStop(1, 'rgba(200, 30, 0, 0)');

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(32, 10);
  ctx.quadraticCurveTo(58, 60, 52, 100);
  ctx.quadraticCurveTo(32, 120, 12, 100);
  ctx.quadraticCurveTo(6, 60, 32, 10);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Procedural Tall Grass tuft texture for dungeon wild grass patches.
 */
export function createGrassTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, 128, 128);

  // Draw 7-8 stylized grassy blades
  const blades = [
    { x: 30, h: 90, c: '#15803d', w: 8, curve: -15 },
    { x: 45, h: 110, c: '#16a34a', w: 10, curve: -8 },
    { x: 64, h: 120, c: '#22c55e', w: 11, curve: 0 },
    { x: 80, h: 105, c: '#16a34a', w: 9, curve: 10 },
    { x: 95, h: 85, c: '#15803d', w: 8, curve: 18 },
    { x: 52, h: 70, c: '#4ade80', w: 6, curve: -4 },
    { x: 74, h: 75, c: '#86efac', w: 6, curve: 6 },
  ];

  blades.forEach((b) => {
    ctx.fillStyle = b.c;
    ctx.beginPath();
    ctx.moveTo(b.x - b.w / 2, 128);
    ctx.quadraticCurveTo(
      b.x + b.curve,
      128 - b.h * 0.5,
      b.x + b.curve * 1.4,
      128 - b.h
    );
    ctx.quadraticCurveTo(
      b.x + b.curve * 0.6,
      128 - b.h * 0.5,
      b.x + b.w / 2,
      128
    );
    ctx.fill();
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Procedural swirling Boss Dark/Fire Aura ring texture.
 */
export function createBossAuraTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, 256, 256);

  const center = 128;
  const grad = ctx.createRadialGradient(center, center, 30, center, center, 120);
  grad.addColorStop(0, 'rgba(225, 29, 72, 0)');
  grad.addColorStop(0.5, 'rgba(225, 29, 72, 0.45)');
  grad.addColorStop(0.75, 'rgba(168, 85, 247, 0.7)');
  grad.addColorStop(0.9, 'rgba(244, 63, 94, 0.9)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(center, center, 120, 0, Math.PI * 2);
  ctx.fill();

  // Spikes and runes
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(center, center, 95, 0, Math.PI * 2);
  ctx.stroke();

  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4;
    const r1 = 80;
    const r2 = 110;
    ctx.beginPath();
    ctx.moveTo(center + Math.cos(angle) * r1, center + Math.sin(angle) * r1);
    ctx.lineTo(center + Math.cos(angle) * r2, center + Math.sin(angle) * r2);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Procedural Descent Portal Rune Texture.
 */
export function createPortalRuneTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, 256, 256);

  const center = 128;
  const grad = ctx.createRadialGradient(center, center, 20, center, center, 120);
  grad.addColorStop(0, 'rgba(56, 189, 248, 0.9)');
  grad.addColorStop(0.4, 'rgba(14, 165, 233, 0.6)');
  grad.addColorStop(0.8, 'rgba(99, 102, 241, 0.4)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(center, center, 120, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(center, center, 85, 0, Math.PI * 2);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
