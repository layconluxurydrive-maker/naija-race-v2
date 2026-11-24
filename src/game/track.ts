import * as THREE from 'three';
import { ProceduralTextureSet } from './textures';
import { getCalibratedTrackPoints, getTrackPreset, TrackPreset } from './trackPresets';
import { TrackId } from './types';

export interface TrackSample {
  point: THREE.Vector3;
  tangent: THREE.Vector3;
  right: THREE.Vector3;
  t: number; // 0..1 around circuit
  distance: number;
}

export interface TrackClosestResult {
  sampleIndex: number;
  t: number;
  distanceFromCenter: number;
  signedLateral: number; // positive = right side of track
  pointOnCenter: THREE.Vector3;
  tangent: THREE.Vector3;
  right: THREE.Vector3;
}

export interface TrackData {
  preset: TrackPreset;
  group: THREE.Group;
  curve: THREE.CatmullRomCurve3;
  samples: TrackSample[];
  totalLength: number;
  roadHalfWidth: number;
  wallHalfWidth: number;
  minimapPathPoints: Array<{ x: number; y: number }>;
  normalizeToMinimap: (worldX: number, worldZ: number) => { x: number; y: number };
  getClosestTrackPoint: (x: number, z: number, hintIndex?: number) => TrackClosestResult;
  setStartLights: (stage: 'off' | 'red1' | 'red2' | 'red3' | 'go') => void;
  dispose: () => void;
}

export function buildCircuitTrack(
  trackId: TrackId,
  textures: ProceduralTextureSet,
  isSoftwareGl: boolean
): TrackData {
  const preset = getTrackPreset(trackId);
  const group = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];

  const roadHalfWidth = preset.roadHalfWidth;
  const curbWidth = 1.35;
  const wallHalfWidth = roadHalfWidth + 2.6;

  const controlPoints = getCalibratedTrackPoints(trackId);
  const curve = new THREE.CatmullRomCurve3(controlPoints, true, 'centripetal', 0.5);
  const totalLength = curve.getLength();
  // Keep segment spacing ~4.5m regardless of 1050m vs 4500m circuit length
  const sampleCount = Math.min(1100, Math.max(440, Math.round(totalLength / 4.2)));
  const samples: TrackSample[] = [];

  for (let i = 0; i < sampleCount; i++) {
    const t = i / sampleCount;
    const point = curve.getPointAt(t);
    point.y = 0;
    const tangent = curve.getTangentAt(t).setY(0).normalize();
    const right = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    samples.push({
      point,
      tangent,
      right,
      t,
      distance: t * totalLength,
    });
  }

  // Compute circuit bounding box & center for minimap, ground, and horizon perimeter
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const s of samples) {
    if (s.point.x < minX) minX = s.point.x;
    if (s.point.x > maxX) maxX = s.point.x;
    if (s.point.z < minZ) minZ = s.point.z;
    if (s.point.z > maxZ) maxZ = s.point.z;
  }
  const spanX = maxX - minX;
  const spanZ = maxZ - minZ;
  const centerX = (minX + maxX) * 0.5;
  const centerZ = (minZ + maxZ) * 0.5;
  const maxSpan = Math.max(spanX, spanZ);
  const padX = (maxSpan - spanX) * 0.5 + maxSpan * 0.1;
  const padZ = (maxSpan - spanZ) * 0.5 + maxSpan * 0.1;
  const mapSpan = maxSpan * 1.2;

  const normalizeToMinimap = (worldX: number, worldZ: number) => ({
    x: (worldX - (minX - padX)) / mapSpan,
    y: (worldZ - (minZ - padZ)) / mapSpan,
  });

  const minimapPathPoints: Array<{ x: number; y: number }> = [];
  const step = Math.max(2, Math.floor(sampleCount / 90));
  for (let i = 0; i < sampleCount; i += step) {
    minimapPathPoints.push(normalizeToMinimap(samples[i].point.x, samples[i].point.z));
  }

  // 1. Expansive Outfield Ground (scales dynamically with track size so no world edge is visible)
  const groundSize = Math.max(2000, maxSpan + 1600);
  const repeatCount = Math.round(groundSize / 26);
  textures.grassMap.repeat.set(repeatCount, repeatCount);

  const groundGeo = new THREE.PlaneGeometry(groundSize, groundSize);
  const groundMat = new THREE.MeshStandardMaterial({
    color: preset.groundTint,
    map: textures.grassMap,
    roughness: 0.92,
    metalness: 0.0,
  });
  const groundMesh = new THREE.Mesh(groundGeo, groundMat);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.position.set(centerX, 0, centerZ);
  groundMesh.receiveShadow = !isSoftwareGl;
  group.add(groundMesh);
  disposables.push(groundGeo, groundMat);

  // 2. Build Continuous Asphalt Ribbon + FIA Left/Right Curbs + Guardrail Ribbons
  const roadVerts: number[] = [];
  const roadUvs: number[] = [];
  const roadNormals: number[] = [];
  const roadIndices: number[] = [];

  const curbVerts: number[] = [];
  const curbUvs: number[] = [];
  const curbNormals: number[] = [];
  const curbIndices: number[] = [];

  const wallVerts: number[] = [];
  const wallNormals: number[] = [];
  const wallIndices: number[] = [];

  const roadY = 0.04;
  const curbY = 0.055;
  const wallHeight = 1.05;

  for (let i = 0; i <= sampleCount; i++) {
    const s = samples[i % sampleCount];
    const vCoord = (i / sampleCount) * (totalLength / 14);

    const rLeftX = s.point.x - s.right.x * roadHalfWidth;
    const rLeftZ = s.point.z - s.right.z * roadHalfWidth;
    const rRightX = s.point.x + s.right.x * roadHalfWidth;
    const rRightZ = s.point.z + s.right.z * roadHalfWidth;

    roadVerts.push(rLeftX, roadY, rLeftZ, rRightX, roadY, rRightZ);
    roadNormals.push(0, 1, 0, 0, 1, 0);
    roadUvs.push(0, vCoord, 1, vCoord);

    const cLInX = s.point.x - s.right.x * (roadHalfWidth - 0.15);
    const cLInZ = s.point.z - s.right.z * (roadHalfWidth - 0.15);
    const cLOutX = s.point.x - s.right.x * (roadHalfWidth + curbWidth);
    const cLOutZ = s.point.z - s.right.z * (roadHalfWidth + curbWidth);

    const cRInX = s.point.x + s.right.x * (roadHalfWidth - 0.15);
    const cRInZ = s.point.z + s.right.z * (roadHalfWidth - 0.15);
    const cROutX = s.point.x + s.right.x * (roadHalfWidth + curbWidth);
    const cROutZ = s.point.z + s.right.z * (roadHalfWidth + curbWidth);

    const curbV = (i / sampleCount) * (totalLength / 6);
    curbVerts.push(
      cLOutX, curbY, cLOutZ,
      cLInX, curbY, cLInZ,
      cRInX, curbY, cRInZ,
      cROutX, curbY, cROutZ
    );
    curbNormals.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
    curbUvs.push(0, curbV, 1, curbV, 0, curbV, 1, curbV);

    const wLX = s.point.x - s.right.x * wallHalfWidth;
    const wLZ = s.point.z - s.right.z * wallHalfWidth;
    const wRX = s.point.x + s.right.x * wallHalfWidth;
    const wRZ = s.point.z + s.right.z * wallHalfWidth;

    wallVerts.push(
      wLX, 0.02, wLZ,
      wLX, wallHeight, wLZ,
      wRX, 0.02, wRZ,
      wRX, wallHeight, wRZ
    );
    wallNormals.push(
      s.right.x, 0.2, s.right.z,
      s.right.x, 0.2, s.right.z,
      -s.right.x, 0.2, -s.right.z,
      -s.right.x, 0.2, -s.right.z
    );

    if (i < sampleCount) {
      const rBase = i * 2;
      roadIndices.push(rBase, rBase + 1, rBase + 2, rBase + 1, rBase + 3, rBase + 2);

      const cBase = i * 4;
      curbIndices.push(cBase, cBase + 1, cBase + 4, cBase + 1, cBase + 5, cBase + 4);
      curbIndices.push(cBase + 2, cBase + 3, cBase + 6, cBase + 3, cBase + 7, cBase + 6);

      const wBase = i * 4;
      wallIndices.push(wBase, wBase + 4, wBase + 1, wBase + 1, wBase + 4, wBase + 5);
      wallIndices.push(wBase + 2, wBase + 3, wBase + 6, wBase + 3, wBase + 7, wBase + 6);
    }
  }

  const roadGeo = new THREE.BufferGeometry();
  roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(roadVerts, 3));
  roadGeo.setAttribute('normal', new THREE.Float32BufferAttribute(roadNormals, 3));
  roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(roadUvs, 2));
  roadGeo.setIndex(roadIndices);

  const roadMat = new THREE.MeshStandardMaterial({
    map: textures.asphaltMap,
    roughness: 0.78,
    metalness: 0.06,
  });
  const roadMesh = new THREE.Mesh(roadGeo, roadMat);
  roadMesh.receiveShadow = !isSoftwareGl;
  group.add(roadMesh);
  disposables.push(roadGeo, roadMat);

  const curbGeo = new THREE.BufferGeometry();
  curbGeo.setAttribute('position', new THREE.Float32BufferAttribute(curbVerts, 3));
  curbGeo.setAttribute('normal', new THREE.Float32BufferAttribute(curbNormals, 3));
  curbGeo.setAttribute('uv', new THREE.Float32BufferAttribute(curbUvs, 2));
  curbGeo.setIndex(curbIndices);

  const curbMat = new THREE.MeshStandardMaterial({
    map: textures.curbMap,
    roughness: 0.65,
    metalness: 0.05,
  });
  const curbMesh = new THREE.Mesh(curbGeo, curbMat);
  curbMesh.receiveShadow = !isSoftwareGl;
  group.add(curbMesh);
  disposables.push(curbGeo, curbMat);

  const wallGeo = new THREE.BufferGeometry();
  wallGeo.setAttribute('position', new THREE.Float32BufferAttribute(wallVerts, 3));
  wallGeo.setAttribute('normal', new THREE.Float32BufferAttribute(wallNormals, 3));
  wallGeo.setIndex(wallIndices);
  wallGeo.computeVertexNormals();

  const wallMat = new THREE.MeshStandardMaterial({
    color: trackId === 'midnight' ? 0x64748b : 0xcbd5e1,
    roughness: 0.38,
    metalness: 0.62,
    side: THREE.DoubleSide,
  });
  const wallMesh = new THREE.Mesh(wallGeo, wallMat);
  wallMesh.receiveShadow = !isSoftwareGl;
  group.add(wallMesh);
  disposables.push(wallGeo, wallMat);

  // 3. Start/Finish Checkered Line & Overhead Gantry Arch (at t = 0)
  const startSample = samples[0];
  const startAngle = Math.atan2(-startSample.tangent.x, -startSample.tangent.z);

  const lineGeo = new THREE.PlaneGeometry(roadHalfWidth * 2 - 0.6, 3.2);
  const lineMat = new THREE.MeshStandardMaterial({
    map: textures.checkeredMap,
    roughness: 0.6,
    metalness: 0.1,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const startLineMesh = new THREE.Mesh(lineGeo, lineMat);
  startLineMesh.rotation.x = -Math.PI / 2;
  startLineMesh.rotation.z = startAngle;
  startLineMesh.position.set(startSample.point.x, roadY + 0.025, startSample.point.z);
  group.add(startLineMesh);
  disposables.push(lineGeo, lineMat);

  // Start/Finish Gantry Arch
  const gantryGroup = new THREE.Group();
  gantryGroup.position.set(startSample.point.x, 0, startSample.point.z);
  gantryGroup.rotation.y = startAngle;

  const pillarGeo = new THREE.BoxGeometry(0.9, 7.6, 0.9);
  const gantrySteelMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.8,
    roughness: 0.28,
  });
  const leftPillar = new THREE.Mesh(pillarGeo, gantrySteelMat);
  leftPillar.position.set(-roadHalfWidth - 1.3, 3.8, 0);
  leftPillar.castShadow = !isSoftwareGl;

  const rightPillar = new THREE.Mesh(pillarGeo, gantrySteelMat);
  rightPillar.position.set(roadHalfWidth + 1.3, 3.8, 0);
  rightPillar.castShadow = !isSoftwareGl;

  const trussGeo = new THREE.BoxGeometry(roadHalfWidth * 2 + 3.6, 1.4, 1.3);
  const trussMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    metalness: 0.6,
    roughness: 0.35,
  });
  const truss = new THREE.Mesh(trussGeo, trussMat);
  truss.position.set(0, 7.4, 0);
  truss.castShadow = !isSoftwareGl;

  const gantryTrimGeo = new THREE.BoxGeometry(roadHalfWidth * 2 + 3.7, 0.22, 1.36);
  const gantryTrimMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    roughness: 0.35,
    metalness: 0.2,
  });
  const gantryTrim = new THREE.Mesh(gantryTrimGeo, gantryTrimMat);
  gantryTrim.position.set(0, 8.05, 0);

  const lightPods: THREE.MeshStandardMaterial[] = [];
  const podGeo = new THREE.SphereGeometry(0.38, 16, 16);
  for (let i = 0; i < 3; i++) {
    const podMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      emissive: 0x000000,
      emissiveIntensity: 0,
      roughness: 0.2,
      metalness: 0.1,
    });
    const pod = new THREE.Mesh(podGeo, podMat);
    pod.position.set((i - 1) * 2.1, 7.4, 0.68);
    gantryGroup.add(pod);
    lightPods.push(podMat);
    disposables.push(podMat);
  }

  gantryGroup.add(leftPillar, rightPillar, truss, gantryTrim);
  group.add(gantryGroup);
  disposables.push(pillarGeo, gantrySteelMat, trussGeo, trussMat, gantryTrimGeo, gantryTrimMat, podGeo);

  const setStartLights = (stage: 'off' | 'red1' | 'red2' | 'red3' | 'go') => {
    for (let i = 0; i < 3; i++) {
      const mat = lightPods[i];
      if (stage === 'off') {
        mat.color.setHex(0x1e293b);
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0;
      } else if (stage === 'go') {
        mat.color.setHex(0x22c55e);
        mat.emissive.setHex(0x22c55e);
        mat.emissiveIntensity = 2.4;
      } else {
        const count = stage === 'red1' ? 1 : stage === 'red2' ? 2 : 3;
        if (i < count) {
          mat.color.setHex(0xef4444);
          mat.emissive.setHex(0xef4444);
          mat.emissiveIntensity = 2.4;
        } else {
          mat.color.setHex(0x1e293b);
          mat.emissive.setHex(0x000000);
          mat.emissiveIntensity = 0;
        }
      }
    }
  };

  // 4. Grandstand along start/finish straight
  const standGroup = new THREE.Group();
  standGroup.position.set(startSample.point.x, 0, startSample.point.z);
  standGroup.rotation.y = startAngle;

  const standBaseGeo = new THREE.BoxGeometry(10, 4.5, 56);
  const standBaseMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7, metalness: 0.2 });
  const standBase = new THREE.Mesh(standBaseGeo, standBaseMat);
  standBase.position.set(roadHalfWidth + 13, 2.25, -4);
  standBase.castShadow = !isSoftwareGl;
  standBase.receiveShadow = !isSoftwareGl;

  const standRoofGeo = new THREE.BoxGeometry(12, 0.5, 58);
  const standRoofMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4, metalness: 0.35 });
  const standRoof = new THREE.Mesh(standRoofGeo, standRoofMat);
  standRoof.position.set(roadHalfWidth + 12, 7.2, -4);
  standRoof.rotation.z = 0.14;
  standRoof.castShadow = !isSoftwareGl;

  standGroup.add(standBase, standRoof);
  group.add(standGroup);
  disposables.push(standBaseGeo, standBaseMat, standRoofGeo, standRoofMat);

  // 5. Instanced Trackside Light Poles (spaced every ~48m around circuit)
  const poleIndices: number[] = [];
  const poleStep = Math.max(12, Math.round(sampleCount / (totalLength / 48)));
  for (let i = 10; i < sampleCount; i += poleStep) {
    poleIndices.push(i);
  }
  const poleGeo = new THREE.CylinderGeometry(0.14, 0.2, 8.5, 8);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.85, roughness: 0.25 });
  const poleInstances = new THREE.InstancedMesh(poleGeo, poleMat, poleIndices.length);

  const lampGeo = new THREE.BoxGeometry(1.6, 0.25, 0.6);
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xfef3c7,
    emissive: trackId === 'midnight' ? 0xfef08a : 0xfde68a,
    emissiveIntensity: trackId === 'midnight' ? 2.6 : 1.4,
    roughness: 0.2,
  });
  const lampInstances = new THREE.InstancedMesh(lampGeo, lampMat, poleIndices.length);

  const dummy = new THREE.Object3D();
  poleIndices.forEach((sIdx, idx) => {
    const s = samples[sIdx];
    const side = idx % 2 === 0 ? 1 : -1;
    const px = s.point.x + s.right.x * (wallHalfWidth + 1.8) * side;
    const pz = s.point.z + s.right.z * (wallHalfWidth + 1.8) * side;

    dummy.position.set(px, 4.25, pz);
    dummy.rotation.set(0, Math.atan2(-s.tangent.x, -s.tangent.z), 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    poleInstances.setMatrixAt(idx, dummy.matrix);

    const lx = s.point.x + s.right.x * (wallHalfWidth + 0.9) * side;
    const lz = s.point.z + s.right.z * (wallHalfWidth + 0.9) * side;
    dummy.position.set(lx, 8.4, lz);
    dummy.updateMatrix();
    lampInstances.setMatrixAt(idx, dummy.matrix);
  });
  poleInstances.instanceMatrix.needsUpdate = true;
  lampInstances.instanceMatrix.needsUpdate = true;
  poleInstances.computeBoundingSphere();
  lampInstances.computeBoundingSphere();
  group.add(poleInstances, lampInstances);
  disposables.push(poleGeo, poleMat, lampGeo, lampMat);

  // 6. Instanced Trackside Scenery (Trees, Desert Mesas, or Night City Towers)
  const propPositions: Array<{ x: number; z: number; scale: number; tint: number }> = [];
  let seed = 1337 + trackId.charCodeAt(0) * 97;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  const targetPropCount = Math.min(240, Math.round(140 + (totalLength / 4500) * 100));
  const checkStep = Math.max(3, Math.floor(sampleCount / 140));
  const minClearanceSq = (wallHalfWidth + 14) * (wallHalfWidth + 14);
  const boxPad = 110;

  for (let attempt = 0; attempt < 900 && propPositions.length < targetPropCount; attempt++) {
    const tx = (minX - boxPad) + rand() * (spanX + boxPad * 2);
    const tz = (minZ - boxPad) + rand() * (spanZ + boxPad * 2);
    let minDistSq = Infinity;
    for (let i = 0; i < sampleCount; i += checkStep) {
      const dx = tx - samples[i].point.x;
      const dz = tz - samples[i].point.z;
      const dSq = dx * dx + dz * dz;
      if (dSq < minDistSq) minDistSq = dSq;
    }
    if (minDistSq > minClearanceSq) {
      propPositions.push({
        x: tx,
        z: tz,
        scale: 0.85 + rand() * 0.45,
        tint: 0.8 + rand() * 0.35,
      });
    }
  }

  const baseColor = new THREE.Color(preset.foliageColor);
  const tintColor = new THREE.Color();

  if (trackId === 'midnight') {
    // Sleek illuminated urban towers along the endurance circuit
    const towerGeo = new THREE.BoxGeometry(8, 28, 8);
    const towerMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.45,
      metalness: 0.65,
    });
    const towerInst = new THREE.InstancedMesh(towerGeo, towerMat, propPositions.length);
    propPositions.forEach((tp, idx) => {
      const hScale = 0.7 + (idx % 5) * 0.45;
      dummy.position.set(tp.x, 14 * hScale, tp.z);
      dummy.rotation.set(0, rand() * Math.PI, 0);
      dummy.scale.set(tp.scale, hScale, tp.scale);
      dummy.updateMatrix();
      towerInst.setMatrixAt(idx, dummy.matrix);
      tintColor.setHex(idx % 3 === 0 ? 0x334155 : 0x1e293b).multiplyScalar(tp.tint);
      towerInst.setColorAt(idx, tintColor);
    });
    towerInst.instanceMatrix.needsUpdate = true;
    if (towerInst.instanceColor) towerInst.instanceColor.needsUpdate = true;
    towerInst.computeBoundingSphere();
    group.add(towerInst);
    disposables.push(towerGeo, towerMat);
  } else if (trackId === 'canyon') {
    // Sculpted sandstone canyon rocks & desert scrub
    const rockGeo = new THREE.DodecahedronGeometry(3.6, 0);
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0xa15c38,
      roughness: 0.9,
      metalness: 0.02,
    });
    const rockInst = new THREE.InstancedMesh(rockGeo, rockMat, propPositions.length);
    rockInst.castShadow = !isSoftwareGl;
    propPositions.forEach((tp, idx) => {
      const hScale = 0.8 + (idx % 4) * 0.65;
      dummy.position.set(tp.x, 2.2 * hScale, tp.z);
      dummy.rotation.set(0, rand() * Math.PI * 2, 0);
      dummy.scale.set(tp.scale * 1.4, hScale, tp.scale * 1.2);
      dummy.updateMatrix();
      rockInst.setMatrixAt(idx, dummy.matrix);
      tintColor.copy(baseColor).multiplyScalar(tp.tint);
      rockInst.setColorAt(idx, tintColor);
    });
    rockInst.instanceMatrix.needsUpdate = true;
    if (rockInst.instanceColor) rockInst.instanceColor.needsUpdate = true;
    rockInst.computeBoundingSphere();
    group.add(rockInst);
    disposables.push(rockGeo, rockMat);
  } else {
    // Pine / Cypress trees for Alpine & Coastal circuits
    const trunkGeo = new THREE.CylinderGeometry(0.28, 0.45, 2.8, 7);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3525, roughness: 0.9, metalness: 0.0 });
    const canopyGeo = new THREE.ConeGeometry(2.3, 6.8, 8);
    const canopyMat = new THREE.MeshStandardMaterial({ color: preset.foliageColor, roughness: 0.85, metalness: 0.0 });

    const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, propPositions.length);
    const canopyInst = new THREE.InstancedMesh(canopyGeo, canopyMat, propPositions.length);
    canopyInst.castShadow = !isSoftwareGl;

    propPositions.forEach((tp, idx) => {
      dummy.position.set(tp.x, 1.4 * tp.scale, tp.z);
      dummy.rotation.set(0, rand() * Math.PI * 2, 0);
      dummy.scale.setScalar(tp.scale);
      dummy.updateMatrix();
      trunkInst.setMatrixAt(idx, dummy.matrix);

      dummy.position.set(tp.x, 5.4 * tp.scale, tp.z);
      dummy.updateMatrix();
      canopyInst.setMatrixAt(idx, dummy.matrix);

      tintColor.copy(baseColor).multiplyScalar(tp.tint);
      canopyInst.setColorAt(idx, tintColor);
    });
    trunkInst.instanceMatrix.needsUpdate = true;
    canopyInst.instanceMatrix.needsUpdate = true;
    if (canopyInst.instanceColor) canopyInst.instanceColor.needsUpdate = true;
    trunkInst.computeBoundingSphere();
    canopyInst.computeBoundingSphere();
    group.add(trunkInst, canopyInst);
    disposables.push(trunkGeo, trunkMat, canopyGeo, canopyMat);
  }

  // 7. Distant Mountain Ridge Ring on Horizon (scales outward with track radius)
  const ridgeCount = 28;
  const ridgeRadius = Math.max(460, maxSpan * 0.65 + 240);
  const ridgeGeo = new THREE.ConeGeometry(85, 76, 5);
  const ridgeMat = new THREE.MeshStandardMaterial({
    color: preset.ridgeColor,
    roughness: 0.92,
    metalness: 0.05,
  });
  const ridgeInst = new THREE.InstancedMesh(ridgeGeo, ridgeMat, ridgeCount);
  for (let i = 0; i < ridgeCount; i++) {
    const angle = (i / ridgeCount) * Math.PI * 2;
    const dist = ridgeRadius + (i % 3) * 75;
    dummy.position.set(centerX + Math.cos(angle) * dist, 28, centerZ + Math.sin(angle) * dist);
    dummy.rotation.set(0, angle, 0);
    dummy.scale.set(1.4 + (i % 2) * 0.5, 0.9 + (i % 4) * 0.35, 1.2);
    dummy.updateMatrix();
    ridgeInst.setMatrixAt(i, dummy.matrix);
  }
  ridgeInst.instanceMatrix.needsUpdate = true;
  ridgeInst.computeBoundingSphere();
  group.add(ridgeInst);
  disposables.push(ridgeGeo, ridgeMat);

  // Fast closest track point lookup (local search around hintIndex, fallback to full scan)
  const _delta = new THREE.Vector3();
  const getClosestTrackPoint = (x: number, z: number, hintIndex?: number): TrackClosestResult => {
    let bestIdx = 0;
    let bestDistSq = Infinity;

    if (hintIndex !== undefined && hintIndex >= 0 && hintIndex < sampleCount) {
      const windowRadius = 38;
      for (let offset = -windowRadius; offset <= windowRadius; offset++) {
        const idx = (hintIndex + offset + sampleCount) % sampleCount;
        const p = samples[idx].point;
        const dx = x - p.x;
        const dz = z - p.z;
        const dSq = dx * dx + dz * dz;
        if (dSq < bestDistSq) {
          bestDistSq = dSq;
          bestIdx = idx;
        }
      }
    }

    if (bestDistSq > 40 * 40 || hintIndex === undefined) {
      bestDistSq = Infinity;
      for (let i = 0; i < sampleCount; i++) {
        const p = samples[i].point;
        const dx = x - p.x;
        const dz = z - p.z;
        const dSq = dx * dx + dz * dz;
        if (dSq < bestDistSq) {
          bestDistSq = dSq;
          bestIdx = i;
        }
      }
    }

    const s = samples[bestIdx];
    _delta.set(x - s.point.x, 0, z - s.point.z);
    const signedLateral = _delta.dot(s.right);

    return {
      sampleIndex: bestIdx,
      t: s.t,
      distanceFromCenter: Math.abs(signedLateral),
      signedLateral,
      pointOnCenter: s.point,
      tangent: s.tangent,
      right: s.right,
    };
  };

  return {
    preset,
    group,
    curve,
    samples,
    totalLength,
    roadHalfWidth,
    wallHalfWidth,
    minimapPathPoints,
    normalizeToMinimap,
    getClosestTrackPoint,
    setStartLights,
    dispose: () => {
      for (const d of disposables) {
        d.dispose();
      }
    },
  };
}
