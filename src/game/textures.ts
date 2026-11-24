import * as THREE from 'three';

export interface ProceduralTextureSet {
  asphaltMap: THREE.CanvasTexture;
  curbMap: THREE.CanvasTexture;
  grassMap: THREE.CanvasTexture;
  checkeredMap: THREE.CanvasTexture;
  contactShadowMap: THREE.CanvasTexture;
  naira10Map: THREE.CanvasTexture;
  nairaBeaconMap: THREE.CanvasTexture;
  dispose: () => void;
}

function createNaira10CanvasTexture(anisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Base warm cream-ochre & terracotta-crimson Nigerian ₦10 Naira banknote gradient
  const bg = ctx.createLinearGradient(0, 0, 512, 256);
  bg.addColorStop(0, '#7f1d1d');
  bg.addColorStop(0.22, '#b45309');
  bg.addColorStop(0.5, '#fef3c7');
  bg.addColorStop(0.78, '#c2410c');
  bg.addColorStop(1, '#7f1d1d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 256);

  // Inner parchment field with subtle guilloche wave security lines
  ctx.fillStyle = '#fde68a';
  ctx.fillRect(16, 16, 480, 224);

  const innerGrad = ctx.createLinearGradient(16, 16, 496, 240);
  innerGrad.addColorStop(0, 'rgba(185, 28, 28, 0.22)');
  innerGrad.addColorStop(0.35, 'rgba(254, 243, 199, 0.92)');
  innerGrad.addColorStop(0.68, 'rgba(245, 158, 11, 0.25)');
  innerGrad.addColorStop(1, 'rgba(154, 52, 18, 0.34)');
  ctx.fillStyle = innerGrad;
  ctx.fillRect(16, 16, 480, 224);

  // Security guilloche wave pattern
  ctx.strokeStyle = 'rgba(180, 83, 9, 0.22)';
  ctx.lineWidth = 1.5;
  for (let row = 0; row < 12; row++) {
    ctx.beginPath();
    const yBase = 24 + row * 18;
    for (let x = 20; x <= 492; x += 12) {
      const y = yBase + Math.sin(x * 0.045 + row * 0.6) * 5;
      if (x === 20) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Outer engraved border frame
  ctx.strokeStyle = '#7c2d12';
  ctx.lineWidth = 5;
  ctx.strokeRect(10, 10, 492, 236);
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2;
  ctx.strokeRect(18, 18, 476, 220);

  // Nigerian Green-White-Green vertical security band on left
  ctx.fillStyle = '#047857';
  ctx.fillRect(22, 22, 12, 212);
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(34, 22, 10, 212);
  ctx.fillStyle = '#047857';
  ctx.fillRect(44, 22, 12, 212);

  // Center portrait medallion / emblem inspired by the classic ₦10 note
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(240, 134, 56, 68, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(180, 83, 9, 0.16)';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#9a3412';
  ctx.stroke();

  // Stylized bust/seal inside medallion
  ctx.fillStyle = '#7c2d12';
  ctx.beginPath();
  ctx.arc(240, 114, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(240, 162, 34, 22, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Right-side clear polymer watermark oval with bold ₦10
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(396, 134, 52, 42, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 251, 235, 0.85)';
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#047857';
  ctx.stroke();

  ctx.fillStyle = '#047857';
  ctx.font = 'bold 42px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('₦10', 396, 136);
  ctx.restore();

  // Header Typography: CENTRAL BANK OF NIGERIA
  ctx.fillStyle = '#7c2d12';
  ctx.font = 'bold 21px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('CENTRAL BANK OF NIGERIA', 274, 46);

  // Corner & Center Bold Denominations
  ctx.fillStyle = '#991b1b';
  ctx.font = 'bold 46px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('₦10', 68, 86);

  ctx.textAlign = 'right';
  ctx.font = 'bold 42px sans-serif';
  ctx.fillText('10', 482, 62);
  ctx.fillText('10', 482, 226);

  // Bottom Banner: TEN NAIRA
  ctx.fillStyle = '#065f46';
  ctx.fillRect(130, 198, 250, 32);
  ctx.fillStyle = '#fef3c7';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('TEN NAIRA', 255, 215);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = anisotropy;
  return texture;
}

function createNairaBeaconTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 14, 64, 64, 62);
  grad.addColorStop(0, 'rgba(16, 185, 129, 0.65)');
  grad.addColorStop(0.55, 'rgba(245, 158, 11, 0.42)');
  grad.addColorStop(1, 'rgba(245, 158, 11, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createProceduralTextures(maxAnisotropy: number): ProceduralTextureSet {
  const anisotropy = Math.max(1, Math.min(8, maxAnisotropy));

  // 1. Asphalt texture with subtle racing groove & dashed centerline
  const asphaltCanvas = document.createElement('canvas');
  asphaltCanvas.width = 512;
  asphaltCanvas.height = 512;
  const actx = asphaltCanvas.getContext('2d')!;
  actx.fillStyle = '#252932';
  actx.fillRect(0, 0, 512, 512);

  // Subtle darker rubbered-in racing groove in the center-left/right lanes
  const groove = actx.createLinearGradient(0, 0, 512, 0);
  groove.addColorStop(0, 'rgba(18, 20, 26, 0.35)');
  groove.addColorStop(0.18, 'rgba(34, 38, 46, 0.0)');
  groove.addColorStop(0.5, 'rgba(18, 20, 26, 0.22)');
  groove.addColorStop(0.82, 'rgba(34, 38, 46, 0.0)');
  groove.addColorStop(1, 'rgba(18, 20, 26, 0.35)');
  actx.fillStyle = groove;
  actx.fillRect(0, 0, 512, 512);

  // Fine mineral aggregate speckle
  for (let i = 0; i < 9000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const shade = 28 + Math.floor(Math.random() * 34);
    actx.fillStyle = `rgb(${shade},${shade + 2},${shade + 5})`;
    actx.fillRect(x, y, 2, 2);
  }

  // Crisp outer white track boundary lines
  actx.fillStyle = '#E2E8F0';
  actx.fillRect(14, 0, 10, 512);
  actx.fillRect(488, 0, 10, 512);

  // Subtle dashed center lane marker
  actx.fillStyle = 'rgba(226, 232, 240, 0.42)';
  for (let y = 16; y < 512; y += 64) {
    actx.fillRect(253, y, 6, 32);
  }

  const asphaltMap = new THREE.CanvasTexture(asphaltCanvas);
  asphaltMap.colorSpace = THREE.SRGBColorSpace;
  asphaltMap.wrapS = THREE.ClampToEdgeWrapping;
  asphaltMap.wrapT = THREE.RepeatWrapping;
  asphaltMap.anisotropy = anisotropy;

  // 2. FIA Red/White apex curb texture
  const curbCanvas = document.createElement('canvas');
  curbCanvas.width = 128;
  curbCanvas.height = 512;
  const cctx = curbCanvas.getContext('2d')!;
  const stripeH = 64;
  for (let y = 0; y < 512; y += stripeH) {
    cctx.fillStyle = (y / stripeH) % 2 === 0 ? '#DC2626' : '#F8FAFC';
    cctx.fillRect(0, y, 128, stripeH);
    cctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
    cctx.fillRect(0, y + stripeH - 4, 128, 4);
  }
  const curbMap = new THREE.CanvasTexture(curbCanvas);
  curbMap.colorSpace = THREE.SRGBColorSpace;
  curbMap.wrapS = THREE.ClampToEdgeWrapping;
  curbMap.wrapT = THREE.RepeatWrapping;
  curbMap.anisotropy = anisotropy;

  // 3. Neutral textured terrain map (tinted per circuit: turf, coastal sand, canyon rock, night)
  const grassCanvas = document.createElement('canvas');
  grassCanvas.width = 512;
  grassCanvas.height = 512;
  const gctx = grassCanvas.getContext('2d')!;
  gctx.fillStyle = '#b4b8b2';
  gctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 6500; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const v = 148 + Math.floor(Math.random() * 52);
    gctx.fillStyle = `rgb(${v}, ${v + 2}, ${v - 2})`;
    gctx.fillRect(x, y, 3, 3);
  }
  // Subtle surface bands
  gctx.fillStyle = 'rgba(255, 255, 255, 0.045)';
  for (let y = 0; y < 512; y += 64) {
    gctx.fillRect(0, y, 512, 32);
  }
  const grassMap = new THREE.CanvasTexture(grassCanvas);
  grassMap.colorSpace = THREE.SRGBColorSpace;
  grassMap.wrapS = THREE.RepeatWrapping;
  grassMap.wrapT = THREE.RepeatWrapping;
  grassMap.repeat.set(64, 64);
  grassMap.anisotropy = anisotropy;

  // 4. Start/Finish checkered line texture
  const chkCanvas = document.createElement('canvas');
  chkCanvas.width = 512;
  chkCanvas.height = 128;
  const kctx = chkCanvas.getContext('2d')!;
  const cell = 32;
  for (let y = 0; y < 128; y += cell) {
    for (let x = 0; x < 512; x += cell) {
      kctx.fillStyle = ((x / cell + y / cell) % 2 === 0) ? '#F8FAFC' : '#0F172A';
      kctx.fillRect(x, y, cell, cell);
    }
  }
  const checkeredMap = new THREE.CanvasTexture(chkCanvas);
  checkeredMap.colorSpace = THREE.SRGBColorSpace;
  checkeredMap.anisotropy = anisotropy;

  // 5. Radial soft contact shadow under each car
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 256;
  shadowCanvas.height = 256;
  const sctx = shadowCanvas.getContext('2d')!;
  const grad = sctx.createRadialGradient(128, 128, 18, 128, 128, 120);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.45)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
  sctx.fillStyle = grad;
  sctx.fillRect(0, 0, 256, 256);
  const contactShadowMap = new THREE.CanvasTexture(shadowCanvas);

  // 6. Nigerian 10 Naira Note + Pickup Glow Beacon
  const naira10Map = createNaira10CanvasTexture(anisotropy);
  const nairaBeaconMap = createNairaBeaconTexture();

  return {
    asphaltMap,
    curbMap,
    grassMap,
    checkeredMap,
    contactShadowMap,
    naira10Map,
    nairaBeaconMap,
    dispose: () => {
      asphaltMap.dispose();
      curbMap.dispose();
      grassMap.dispose();
      checkeredMap.dispose();
      contactShadowMap.dispose();
      naira10Map.dispose();
      nairaBeaconMap.dispose();
    },
  };
}
