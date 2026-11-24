import * as THREE from 'three';
import { TrackId, TrackSummary } from './types';

export interface TrackPreset {
  id: TrackId;
  name: string;
  subtitle: string;
  targetLengthMeters: number;
  styleTag: string;
  accentHex: string;
  roadHalfWidth: number;
  skyColor: number;
  fogColor: number;
  fogDensity: number;
  sunColor: number;
  sunIntensity: number;
  hemiSkyColor: number;
  hemiGroundColor: number;
  hemiIntensity: number;
  groundTint: number;
  foliageColor: number;
  ridgeColor: number;
  rawPoints: Array<[number, number]>;
}

const RAW_PRESETS: TrackPreset[] = [
  {
    id: 'alpine',
    name: 'Alpine Club',
    subtitle: 'Fast technical club circuit with sweeping apexes',
    targetLengthMeters: 1050,
    styleTag: 'Technical Sprint',
    accentHex: '#22C55E',
    roadHalfWidth: 9.2,
    skyColor: 0x9ec5e6,
    fogColor: 0x9ec5e6,
    fogDensity: 0.0016,
    sunColor: 0xfff1d6,
    sunIntensity: 1.85,
    hemiSkyColor: 0xa5d8ff,
    hemiGroundColor: 0x263829,
    hemiIntensity: 0.78,
    groundTint: 0x3a543e,
    foliageColor: 0x2f5a38,
    ridgeColor: 0x334155,
    rawPoints: [
      [0, 45],
      [0, -55],
      [14, -135],
      [85, -175],
      [175, -155],
      [235, -90],
      [210, -10],
      [135, 10],
      [120, 85],
      [175, 155],
      [95, 195],
      [18, 145],
    ],
  },
  {
    id: 'coastal',
    name: 'Azure Coast GP',
    subtitle: 'High-speed oceanfront sweepers & long straightaways',
    targetLengthMeters: 2250,
    styleTag: 'High-Speed Flow',
    accentHex: '#38BDF8',
    roadHalfWidth: 10.0,
    skyColor: 0x87ceeb,
    fogColor: 0xa7d8f0,
    fogDensity: 0.0011,
    sunColor: 0xfff5e0,
    sunIntensity: 1.95,
    hemiSkyColor: 0xbae6fd,
    hemiGroundColor: 0x6b705c,
    hemiIntensity: 0.85,
    groundTint: 0x6a7d58,
    foliageColor: 0x3a6b48,
    ridgeColor: 0x475569,
    rawPoints: [
      [0, 80],
      [0, -140],
      [35, -270],
      [165, -340],
      [340, -320],
      [480, -210],
      [510, -45],
      [405, 65],
      [460, 210],
      [365, 340],
      [195, 355],
      [115, 240],
      [30, 215],
    ],
  },
  {
    id: 'canyon',
    name: 'Redstone Canyon',
    subtitle: 'Sunset desert endurance loop with hairpin switchbacks',
    targetLengthMeters: 3400,
    styleTag: 'Desert Endurance',
    accentHex: '#F59E0B',
    roadHalfWidth: 10.4,
    skyColor: 0xe6a87c,
    fogColor: 0xd99b72,
    fogDensity: 0.00095,
    sunColor: 0xffcfa0,
    sunIntensity: 2.0,
    hemiSkyColor: 0xfdba74,
    hemiGroundColor: 0x7c4a2d,
    hemiIntensity: 0.72,
    groundTint: 0xb0754d,
    foliageColor: 0x6b703a,
    ridgeColor: 0x7c3f27,
    rawPoints: [
      [0, 120],
      [0, -220],
      [55, -420],
      [250, -520],
      [510, -480],
      [710, -320],
      [760, -110],
      [560, -20],
      [510, 140],
      [710, 290],
      [620, 480],
      [350, 520],
      [210, 360],
      [120, 440],
      [20, 340],
    ],
  },
  {
    id: 'midnight',
    name: 'Metro Endurance',
    subtitle: '4.5 km floodlit night circuit built for top-speed battles',
    targetLengthMeters: 4500,
    styleTag: '4.5km Endurance',
    accentHex: '#A78BFA',
    roadHalfWidth: 10.8,
    skyColor: 0x0f172a,
    fogColor: 0x131d33,
    fogDensity: 0.0009,
    sunColor: 0xcbd5e1,
    sunIntensity: 1.15,
    hemiSkyColor: 0x475569,
    hemiGroundColor: 0x1e293b,
    hemiIntensity: 0.88,
    groundTint: 0x26313f,
    foliageColor: 0x1f3a32,
    ridgeColor: 0x1e293b,
    rawPoints: [
      [0, 180],
      [0, -320],
      [65, -580],
      [310, -720],
      [660, -700],
      [960, -510],
      [1040, -210],
      [810, -60],
      [960, 170],
      [920, 470],
      [650, 660],
      [380, 560],
      [300, 330],
      [170, 450],
      [35, 420],
    ],
  },
];

function buildCalibratedControlPoints(preset: TrackPreset): THREE.Vector3[] {
  const baseVecs = preset.rawPoints.map(([x, z]) => new THREE.Vector3(x, 0, z));
  const rawCurve = new THREE.CatmullRomCurve3(baseVecs, true, 'centripetal', 0.5);
  const rawLength = rawCurve.getLength();
  const scale = preset.targetLengthMeters / rawLength;

  return preset.rawPoints.map(([x, z]) => new THREE.Vector3(x * scale, 0, z * scale));
}

function buildNormalizedPreview(points: THREE.Vector3[]): Array<{ x: number; y: number }> {
  const curve = new THREE.CatmullRomCurve3(points, true, 'centripetal', 0.5);
  const sampleCount = 80;
  const sampled: THREE.Vector3[] = [];
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < sampleCount; i++) {
    const p = curve.getPointAt(i / sampleCount);
    sampled.push(p);
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.z < minZ) minZ = p.z;
    if (p.z > maxZ) maxZ = p.z;
  }
  const spanX = maxX - minX;
  const spanZ = maxZ - minZ;
  const maxSpan = Math.max(spanX, spanZ);
  const padX = (maxSpan - spanX) * 0.5 + maxSpan * 0.1;
  const padZ = (maxSpan - spanZ) * 0.5 + maxSpan * 0.1;
  const mapSpan = maxSpan * 1.2;

  return sampled.map((p) => ({
    x: (p.x - (minX - padX)) / mapSpan,
    y: (p.z - (minZ - padZ)) / mapSpan,
  }));
}

export function getTrackPreset(id: TrackId): TrackPreset {
  return RAW_PRESETS.find((p) => p.id === id) ?? RAW_PRESETS[0];
}

export function getCalibratedTrackPoints(id: TrackId): THREE.Vector3[] {
  return buildCalibratedControlPoints(getTrackPreset(id));
}

export const TRACK_SUMMARIES: TrackSummary[] = RAW_PRESETS.map((preset) => {
  const pts = buildCalibratedControlPoints(preset);
  return {
    id: preset.id,
    name: preset.name,
    subtitle: preset.subtitle,
    targetLengthMeters: preset.targetLengthMeters,
    styleTag: preset.styleTag,
    accentHex: preset.accentHex,
    previewPoints: buildNormalizedPreview(pts),
  };
});
