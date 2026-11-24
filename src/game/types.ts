export type GamePhase = 'ready' | 'countdown' | 'racing' | 'paused' | 'finished';

export type CameraMode = 'chase' | 'hood' | 'far';

export type Difficulty = 'casual' | 'pro';

export type SteeringStyle = 'grip' | 'arcade' | 'drift';

export type SteeringInputMode = 'keyboard' | 'mouse' | 'onscreen' | 'tilt';

export type CarBodyStyle = 'gt' | 'street' | 'coupe' | 'drift' | 'hyper' | 'proto';

export interface CarSpec {
  id: string;
  name: string;
  category: string;
  description: string;
  priceNaira: number;
  bodyStyle: CarBodyStyle;
  defaultPrimaryHex: string;
  defaultAccentHex: string;
  defaultPrimaryValue: number;
  defaultAccentValue: number;
  topSpeedKmh: number;
  speedMult: number;
  accelMult: number;
  handlingMult: number;
  nitroMult: number;
  // UI 1-100 rating bars
  statSpeed: number;
  statAccel: number;
  statHandling: number;
}

export const CAR_COLLECTION: CarSpec[] = [
  {
    id: 'lagos-gt',
    name: 'Lagos GT',
    category: 'Starter Coupe',
    description: 'Balanced street-circuit coupe with predictable handling and clean aero.',
    priceNaira: 0,
    bodyStyle: 'gt',
    defaultPrimaryHex: '#DC2626',
    defaultAccentHex: '#F59E0B',
    defaultPrimaryValue: 0xdc2626,
    defaultAccentValue: 0xf59e0b,
    topSpeedKmh: 234,
    speedMult: 1.0,
    accelMult: 1.0,
    handlingMult: 1.0,
    nitroMult: 1.0,
    statSpeed: 72,
    statAccel: 70,
    statHandling: 74,
  },
  {
    id: 'danfo-turbo',
    name: 'Danfo Turbo',
    category: 'Lagos Street Spec',
    description: 'Iconic yellow street machine tuned with twin-scroll boost and sharp low-end launch.',
    priceNaira: 150,
    bodyStyle: 'street',
    defaultPrimaryHex: '#EAB308',
    defaultAccentHex: '#18181B',
    defaultPrimaryValue: 0xeab308,
    defaultAccentValue: 0x18181b,
    topSpeedKmh: 244,
    speedMult: 1.04,
    accelMult: 1.12,
    handlingMult: 1.05,
    nitroMult: 1.08,
    statSpeed: 78,
    statAccel: 84,
    statHandling: 79,
  },
  {
    id: 'abuja-coupe',
    name: 'Abuja V8 Coupe',
    category: 'Executive GT',
    description: 'Long-wheelbase grand tourer with green-white livery and high-speed stability.',
    priceNaira: 300,
    bodyStyle: 'coupe',
    defaultPrimaryHex: '#059669',
    defaultAccentHex: '#F8FAFC',
    defaultPrimaryValue: 0x059669,
    defaultAccentValue: 0xf8fafc,
    topSpeedKmh: 256,
    speedMult: 1.09,
    accelMult: 1.08,
    handlingMult: 1.06,
    nitroMult: 1.14,
    statSpeed: 84,
    statAccel: 80,
    statHandling: 82,
  },
  {
    id: 'eko-drift',
    name: 'Eko Drift Spec',
    category: 'Widebody Tuner',
    description: 'Aggressive widebody chassis engineered for effortless corner-exit slides.',
    priceNaira: 500,
    bodyStyle: 'drift',
    defaultPrimaryHex: '#2563EB',
    defaultAccentHex: '#F97316',
    defaultPrimaryValue: 0x2563eb,
    defaultAccentValue: 0xf97316,
    topSpeedKmh: 265,
    speedMult: 1.13,
    accelMult: 1.15,
    handlingMult: 1.18,
    nitroMult: 1.2,
    statSpeed: 88,
    statAccel: 87,
    statHandling: 94,
  },
  {
    id: 'zuma-hyper',
    name: 'Zuma V12 Hyper',
    category: 'Mid-Engine Hypercar',
    description: 'Razor-sharp wedge profile with massive downforce and scorching straight-line pace.',
    priceNaira: 850,
    bodyStyle: 'hyper',
    defaultPrimaryHex: '#1E293B',
    defaultAccentHex: '#F59E0B',
    defaultPrimaryValue: 0x1e293b,
    defaultAccentValue: 0xf59e0b,
    topSpeedKmh: 278,
    speedMult: 1.18,
    accelMult: 1.22,
    handlingMult: 1.16,
    nitroMult: 1.26,
    statSpeed: 94,
    statAccel: 93,
    statHandling: 91,
  },
  {
    id: 'naija-proto',
    name: 'Naija Apex Proto',
    category: 'Endurance Prototype',
    description: 'Championship green-and-gold endurance racer built to dominate every circuit.',
    priceNaira: 1400,
    bodyStyle: 'proto',
    defaultPrimaryHex: '#047857',
    defaultAccentHex: '#FBBF24',
    defaultPrimaryValue: 0x047857,
    defaultAccentValue: 0xfbbf24,
    topSpeedKmh: 292,
    speedMult: 1.24,
    accelMult: 1.28,
    handlingMult: 1.24,
    nitroMult: 1.35,
    statSpeed: 99,
    statAccel: 98,
    statHandling: 98,
  },
];

export interface RaceSettings {
  laps: number;
  difficulty: Difficulty;
  steeringStyle: SteeringStyle;
  steeringInput: SteeringInputMode;
  steeringSensitivity: number;
  volume: number;
  muted: boolean;
}

export interface LiveryOption {
  id: string;
  name: string;
  primaryHex: string;
  accentHex: string;
  colorValue: number;
  accentValue: number;
}

export const LIVERY_OPTIONS: LiveryOption[] = [
  {
    id: 'factory',
    name: 'Factory Paint',
    primaryHex: '#DC2626',
    accentHex: '#F59E0B',
    colorValue: 0xdc2626,
    accentValue: 0xf59e0b,
  },
  {
    id: 'naija-green',
    name: 'Naija Emerald',
    primaryHex: '#059669',
    accentHex: '#F8FAFC',
    colorValue: 0x059669,
    accentValue: 0xf8fafc,
  },
  {
    id: 'cobalt',
    name: 'Cobalt Works',
    primaryHex: '#2563EB',
    accentHex: '#38BDF8',
    colorValue: 0x2563eb,
    accentValue: 0x38bdf8,
  },
  {
    id: 'obsidian',
    name: 'Carbon Gold',
    primaryHex: '#1E293B',
    accentHex: '#F59E0B',
    colorValue: 0x1e293b,
    accentValue: 0xf59e0b,
  },
];

export interface RacerStandingsEntry {
  id: string;
  name: string;
  colorHex: string;
  isPlayer: boolean;
  position: number;
  lap: number;
  totalProgress: number;
  finished: boolean;
  finishTimeMs: number | null;
}

export interface MinimapMarker {
  id: string;
  x: number; // normalized 0..1
  y: number; // normalized 0..1
  colorHex: string;
  isPlayer: boolean;
}

export type TrackId = 'alpine' | 'coastal' | 'canyon' | 'midnight';

export interface TrackSummary {
  id: TrackId;
  name: string;
  subtitle: string;
  targetLengthMeters: number;
  styleTag: string;
  accentHex: string;
  previewPoints: Array<{ x: number; y: number }>;
}

export interface FinishNotification {
  id: string;
  racerId: string;
  name: string;
  colorHex: string;
  position: number;
  finishTimeMs: number;
  timestamp: number;
}

export interface RaceTelemetry {
  phase: GamePhase;
  trackId: TrackId;
  trackName: string;
  trackLengthMeters: number;
  countdownValue: number; // 3, 2, 1, 0 (GO)
  speedKmh: number;
  gear: string;
  rpmRatio: number; // 0..1
  nitro: number; // 0..100
  isBoosting: boolean;
  isDrifting: boolean;
  lap: number;
  totalLaps: number;
  position: number;
  totalRacers: number;
  raceTimeMs: number;
  currentLapTimeMs: number;
  bestLapTimeMs: number | null;
  standings: RacerStandingsEntry[];
  minimapMarkers: MinimapMarker[];
  wrongWay: boolean;
  steerAxis: number;
  isGameOver: boolean;
  notifications: FinishNotification[];
  sessionNaira: number;
  notesCollectedCount: number;
  podiumBonusNaira: number;
  lastNairaPickupAt: number;
}

export interface InputState {
  throttle: boolean;
  brake: boolean;
  left: boolean;
  right: boolean;
  drift: boolean;
  boost: boolean;
  analogSteer: number | null; // -1 (right) to +1 (left), null when using digital buttons
}
