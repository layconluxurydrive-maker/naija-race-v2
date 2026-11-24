import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { RacingAudio } from './audio';
import { createRaceCarModel, RaceCarMeshHandle } from './carModel';
import { createProceduralTextures, ProceduralTextureSet } from './textures';
import { buildCircuitTrack, TrackData } from './track';
import {
  CameraMode,
  CAR_COLLECTION,
  CarSpec,
  Difficulty,
  FinishNotification,
  GamePhase,
  InputState,
  LIVERY_OPTIONS,
  LiveryOption,
  MinimapMarker,
  RacerStandingsEntry,
  RaceTelemetry,
  SteeringStyle,
  TrackId,
} from './types';

// Reusable scratch math objects (zero GC in animation loop)
const _vecA = new THREE.Vector3();
const _vecB = new THREE.Vector3();
const _vecC = new THREE.Vector3();
const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

interface RacerEntity {
  id: string;
  name: string;
  colorHex: string;
  isPlayer: boolean;
  mesh: RaceCarMeshHandle;
  x: number;
  z: number;
  yaw: number;
  vx: number;
  vz: number;
  speed: number;
  steerAngle: number;
  rollAngle: number;
  pitchAngle: number;
  nitro: number;
  isBoosting: boolean;
  isDrifting: boolean;
  isBraking: boolean;
  closestIdx: number;
  lastRawT: number;
  unwrappedT: number;
  lap: number;
  lapStartTimeMs: number;
  bestLapTimeMs: number | null;
  finished: boolean;
  finishPosition: number | null;
  finishTimeMs: number | null;
  // AI properties
  aiLaneOffset: number;
  aiBaseSkill: number;
}

interface ParticleSlot {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
  colorHex: number;
}

interface NairaNotePickup {
  x: number;
  z: number;
  phaseOffset: number;
  active: boolean;
  respawnTimer: number;
  noteMesh: THREE.Mesh;
  beaconMesh: THREE.Mesh;
}

export class RacingEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private sunLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private textures: ProceduralTextureSet;
  private trackId: TrackId = 'alpine';
  private track: TrackData;
  private audio: RacingAudio;
  private isSoftwareGl: boolean;

  private racers: RacerEntity[] = [];
  private player!: RacerEntity;
  private playerCarSpec: CarSpec = CAR_COLLECTION[0];
  private particlesMesh: THREE.InstancedMesh;
  private particles: ParticleSlot[] = [];
  private particleCursor = 0;

  private nairaGroup: THREE.Group;
  private nairaPickups: NairaNotePickup[] = [];
  private nairaNoteGeo: THREE.BufferGeometry;
  private nairaNoteMat: THREE.MeshStandardMaterial;
  private nairaBeaconGeo: THREE.PlaneGeometry;
  private nairaBeaconMat: THREE.MeshBasicMaterial;

  private phase: GamePhase = 'ready';
  private prePausePhase: 'countdown' | 'racing' = 'racing';
  private difficulty: Difficulty = 'casual';
  private cameraMode: CameraMode = 'chase';
  private steeringStyle: SteeringStyle = 'arcade';
  private steeringSensitivity = 1.0;
  private totalLaps = 3;
  private countdownTimer = 0;
  private lastCountdownBeep = -1;
  private raceElapsedMs = 0;
  private wrongWayTimer = 0;
  private isGameOver = false;
  private finishOrderCount = 0;
  private notifications: FinishNotification[] = [];
  private sessionNaira = 0;
  private notesCollectedCount = 0;
  private podiumBonusNaira = 0;
  private lastNairaPickupAt = 0;
  private lastTelemetryPush = 0;
  private frameId = 0;
  private disposed = false;
  private contextLost = false;
  private lastTime = performance.now();

  private cameraPos = new THREE.Vector3(0, 6, 20);
  private cameraLookAt = new THREE.Vector3(0, 1, 0);
  private currentFov = 62;
  private camRoll = 0;

  private input: InputState = {
    throttle: false,
    brake: false,
    left: false,
    right: false,
    drift: false,
    boost: false,
    analogSteer: null,
  };

  private onTelemetry: (t: RaceTelemetry) => void;
  private onContextLostChange?: (lost: boolean) => void;
  private onNairaAwarded?: (amount: number) => void;

  constructor(
    container: HTMLElement,
    onTelemetry: (t: RaceTelemetry) => void,
    onContextLostChange?: (lost: boolean) => void,
    onNairaAwarded?: (amount: number) => void
  ) {
    this.container = container;
    this.onTelemetry = onTelemetry;
    this.onContextLostChange = onContextLostChange;
    this.onNairaAwarded = onNairaAwarded;
    this.audio = new RacingAudio();

    // Detect Software WebGL (SwiftShader, llvmpipe, WARP) to tune GPU cost cleanly
    this.isSoftwareGl = (() => {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);

    const canvas = this.renderer.domElement;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    container.appendChild(canvas);

    canvas.addEventListener('webglcontextlost', this.handleContextLost);
    canvas.addEventListener('webglcontextrestored', this.handleContextRestored);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x9ec5e6);
    this.scene.fog = new THREE.FogExp2(0x9ec5e6, 0.0017);

    // Mandatory Studio Environment Reflections for clearcoat car paint & alloy rims
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(62, width / height, 0.25, 1800);

    // 3-Point Warm/Cool Outdoor Racing Lighting Rig
    const hemi = new THREE.HemisphereLight(0xa5d8ff, 0x263829, 0.78);
    this.scene.add(hemi);
    this.hemiLight = hemi;

    const sun = new THREE.DirectionalLight(0xfff1d6, 1.85);
    sun.position.set(80, 120, 60);
    sun.castShadow = !this.isSoftwareGl;
    sun.shadow.mapSize.set(1024, 1024);
    const d = 48;
    sun.shadow.camera.left = -d;
    sun.shadow.camera.right = d;
    sun.shadow.camera.top = d;
    sun.shadow.camera.bottom = -d;
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 280;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.02;
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sunLight = sun;

    const rim = new THREE.DirectionalLight(0xbae6fd, 0.5);
    rim.position.set(-90, 40, -100);
    this.scene.add(rim);

    // Procedural Textures & Track
    this.textures = createProceduralTextures(this.renderer.capabilities.getMaxAnisotropy());
    this.track = buildCircuitTrack(this.trackId, this.textures, this.isSoftwareGl);
    this.scene.add(this.track.group);
    this.applyTrackAtmosphere();

    // Pre-allocated Particle Pool (Drift Tire Smoke, Boost Sparks & Naira Burst)
    const particleCount = 72;
    const partGeo = new THREE.SphereGeometry(0.32, 6, 6);
    const partMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    this.particlesMesh = new THREE.InstancedMesh(partGeo, partMat, particleCount);
    this.particlesMesh.frustumCulled = false;
    this.scene.add(this.particlesMesh);

    for (let i = 0; i < particleCount; i++) {
      this.particles.push({
        active: false,
        x: 0,
        y: -50,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 0.5,
        size: 1,
        colorHex: 0xdbeafe,
      });
      _dummy.position.set(0, -50, 0);
      _dummy.scale.setScalar(0.001);
      _dummy.updateMatrix();
      this.particlesMesh.setMatrixAt(i, _dummy.matrix);
      _color.setHex(0xe2e8f0);
      this.particlesMesh.setColorAt(i, _color);
    }
    this.particlesMesh.instanceMatrix.needsUpdate = true;
    if (this.particlesMesh.instanceColor) this.particlesMesh.instanceColor.needsUpdate = true;

    // Visible Nigerian ₦10 Naira Banknote Collectibles on the road
    this.nairaGroup = new THREE.Group();
    this.scene.add(this.nairaGroup);

    const noteGeo = new THREE.PlaneGeometry(2.25, 1.15, 8, 1);
    const posAttr = noteGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      posAttr.setZ(i, Math.sin(vx * 1.6) * 0.14);
    }
    noteGeo.computeVertexNormals();
    this.nairaNoteGeo = noteGeo;

    this.nairaNoteMat = new THREE.MeshStandardMaterial({
      map: this.textures.naira10Map,
      emissiveMap: this.textures.naira10Map,
      emissive: 0xffedd5,
      emissiveIntensity: 0.34,
      roughness: 0.42,
      metalness: 0.08,
      side: THREE.DoubleSide,
    });

    this.nairaBeaconGeo = new THREE.PlaneGeometry(2.8, 2.8);
    this.nairaBeaconMat = new THREE.MeshBasicMaterial({
      map: this.textures.nairaBeaconMap,
      transparent: true,
      depthWrite: false,
      opacity: 0.88,
    });

    this.rebuildNairaPickups();

    // Create Racers (Player + 3 AI Opponents)
    this.initRacers(LIVERY_OPTIONS[0]);
    this.resetGrid();

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    window.addEventListener('resize', this.handleResize);
    this.pushTelemetry(true);
    this.tick();
  }

  private initRacers(playerLivery: LiveryOption): void {
    const aiConfigs = [
      { id: 'ai-1', name: 'Elena Vance', colorHex: '#38BDF8', colorValue: 0x0284c7, accentValue: 0xf8fafc, lane: -3.2, skill: 1.0 },
      { id: 'ai-2', name: 'Marco Rossi', colorHex: '#F59E0B', colorValue: 0xd97706, accentValue: 0x0f172a, lane: 3.2, skill: 0.96 },
      { id: 'ai-3', name: 'Kenji Sato', colorHex: '#10B981', colorValue: 0x059669, accentValue: 0xfde047, lane: -1.4, skill: 0.92 },
    ];

    aiConfigs.forEach((cfg) => {
      const mesh = createRaceCarModel(
        cfg.colorValue,
        cfg.accentValue,
        this.textures.contactShadowMap,
        !this.isSoftwareGl
      );
      this.scene.add(mesh.group);
      this.racers.push({
        id: cfg.id,
        name: cfg.name,
        colorHex: cfg.colorHex,
        isPlayer: false,
        mesh,
        x: 0,
        z: 0,
        yaw: 0,
        vx: 0,
        vz: 0,
        speed: 0,
        steerAngle: 0,
        rollAngle: 0,
        pitchAngle: 0,
        nitro: 100,
        isBoosting: false,
        isDrifting: false,
        isBraking: false,
        closestIdx: 0,
        lastRawT: 0,
        unwrappedT: 0,
        lap: 1,
        lapStartTimeMs: 0,
        bestLapTimeMs: null,
        finished: false,
        finishPosition: null,
        finishTimeMs: null,
        aiLaneOffset: cfg.lane,
        aiBaseSkill: cfg.skill,
      });
    });

    const playerMesh = createRaceCarModel(
      playerLivery.colorValue,
      playerLivery.accentValue,
      this.textures.contactShadowMap,
      !this.isSoftwareGl
    );
    this.scene.add(playerMesh.group);

    this.player = {
      id: 'player',
      name: 'You',
      colorHex: playerLivery.primaryHex,
      isPlayer: true,
      mesh: playerMesh,
      x: 0,
      z: 0,
      yaw: 0,
      vx: 0,
      vz: 0,
      speed: 0,
      steerAngle: 0,
      rollAngle: 0,
      pitchAngle: 0,
      nitro: 100,
      isBoosting: false,
      isDrifting: false,
      isBraking: false,
      closestIdx: 0,
      lastRawT: 0,
      unwrappedT: 0,
      lap: 1,
      lapStartTimeMs: 0,
      bestLapTimeMs: null,
      finished: false,
      finishPosition: null,
      finishTimeMs: null,
      aiLaneOffset: 0,
      aiBaseSkill: 1,
    };
    this.racers.push(this.player);
  }

  public setPlayerLivery(livery: LiveryOption): void {
    const primary = livery.id === 'factory' ? this.playerCarSpec.defaultPrimaryValue : livery.colorValue;
    const accent = livery.id === 'factory' ? this.playerCarSpec.defaultAccentValue : livery.accentValue;
    const hex = livery.id === 'factory' ? this.playerCarSpec.defaultPrimaryHex : livery.primaryHex;
    this.player.colorHex = hex;
    this.player.mesh.setLivery(primary, accent);
    this.pushTelemetry(true);
  }

  public setPlayerCar(car: CarSpec, livery?: LiveryOption): void {
    this.playerCarSpec = car;
    const useCustom = livery && livery.id !== 'factory';
    const primary = useCustom ? livery.colorValue : car.defaultPrimaryValue;
    const accent = useCustom ? livery.accentValue : car.defaultAccentValue;
    const hex = useCustom ? livery.primaryHex : car.defaultPrimaryHex;

    this.scene.remove(this.player.mesh.group);
    this.player.mesh.dispose();

    const newMesh = createRaceCarModel(
      primary,
      accent,
      this.textures.contactShadowMap,
      !this.isSoftwareGl,
      car.bodyStyle
    );
    newMesh.group.position.set(this.player.x, 0.04, this.player.z);
    newMesh.group.rotation.set(0, this.player.yaw, 0);
    this.scene.add(newMesh.group);

    this.player.mesh = newMesh;
    this.player.colorHex = hex;
    this.pushTelemetry(true);
  }

  public playPurchaseSound(): void {
    this.audio.unlock();
    this.audio.playPurchaseSuccess();
  }

  public setDifficulty(diff: Difficulty): void {
    this.difficulty = diff;
  }

  public setCameraMode(mode: CameraMode): void {
    this.cameraMode = mode;
  }

  public cycleCameraMode(): CameraMode {
    const order: CameraMode[] = ['chase', 'hood', 'far'];
    const next = order[(order.indexOf(this.cameraMode) + 1) % order.length];
    this.cameraMode = next;
    return next;
  }

  public setMuted(mute: boolean): void {
    this.audio.setMuted(mute);
  }

  public setVolume(vol: number): void {
    this.audio.setVolume(vol);
  }

  public isMuted(): boolean {
    return this.audio.isMuted();
  }

  public setLaps(laps: number): void {
    this.totalLaps = Math.max(1, Math.min(10, laps));
    this.pushTelemetry(true);
  }

  public setSteeringStyle(style: SteeringStyle): void {
    this.steeringStyle = style;
  }

  public setSteeringSensitivity(sens: number): void {
    this.steeringSensitivity = Math.max(0.5, Math.min(1.8, sens));
  }

  private applyTrackAtmosphere(): void {
    const p = this.track.preset;
    (this.scene.background as THREE.Color).setHex(p.skyColor);
    this.scene.fog = new THREE.FogExp2(p.fogColor, p.fogDensity);
    this.sunLight.color.setHex(p.sunColor);
    this.sunLight.intensity = p.sunIntensity;
    this.hemiLight.color.setHex(p.hemiSkyColor);
    this.hemiLight.groundColor.setHex(p.hemiGroundColor);
    this.hemiLight.intensity = p.hemiIntensity;
    this.renderer.toneMappingExposure = p.id === 'midnight' ? 1.15 : 1.08;
  }

  public setTrack(trackId: TrackId): void {
    if (this.trackId === trackId) return;
    this.trackId = trackId;

    this.scene.remove(this.track.group);
    this.track.dispose();

    this.track = buildCircuitTrack(trackId, this.textures, this.isSoftwareGl);
    this.scene.add(this.track.group);
    this.applyTrackAtmosphere();
    this.rebuildNairaPickups();

    // Clear active particles
    for (let i = 0; i < this.particles.length; i++) {
      this.particles[i].active = false;
      _dummy.position.set(0, -50, 0);
      _dummy.scale.setScalar(0.001);
      _dummy.updateMatrix();
      this.particlesMesh.setMatrixAt(i, _dummy.matrix);
    }
    this.particlesMesh.instanceMatrix.needsUpdate = true;

    this.resetToGrid();
  }

  private rebuildNairaPickups(): void {
    this.nairaGroup.clear();
    this.nairaPickups = [];

    const totalLen = Math.max(200, this.track.totalLength);
    // Space notes every ~65m around the road, skipping the grid area right behind start/finish
    const spacingMeters = 65;
    const noteCount = Math.max(12, Math.floor((totalLen - 85) / spacingMeters));
    const lanePattern = [0, -3.3, 3.3, -1.8, 1.8, 0];

    for (let i = 0; i < noteCount; i++) {
      const distAlong = 52 + i * spacingMeters;
      const t = (distAlong / totalLen) % 1;
      const pt = this.track.curve.getPointAt(t);
      const tan = this.track.curve.getTangentAt(t).setY(0).normalize();
      const right = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
      const laneOffset = lanePattern[i % lanePattern.length];

      const nx = pt.x + right.x * laneOffset;
      const nz = pt.z + right.z * laneOffset;

      const noteMesh = new THREE.Mesh(this.nairaNoteGeo, this.nairaNoteMat);
      noteMesh.position.set(nx, 0.96, nz);
      noteMesh.rotation.set(0.18, i * 0.7, 0.08);
      this.nairaGroup.add(noteMesh);

      const beaconMesh = new THREE.Mesh(this.nairaBeaconGeo, this.nairaBeaconMat);
      beaconMesh.rotation.x = -Math.PI / 2;
      beaconMesh.position.set(nx, 0.068, nz);
      this.nairaGroup.add(beaconMesh);

      this.nairaPickups.push({
        x: nx,
        z: nz,
        phaseOffset: i * 0.65,
        active: true,
        respawnTimer: 0,
        noteMesh,
        beaconMesh,
      });
    }
  }

  private resetAllNairaPickups(): void {
    for (const n of this.nairaPickups) {
      n.active = true;
      n.respawnTimer = 0;
      n.noteMesh.visible = true;
      n.beaconMesh.visible = true;
    }
  }

  public setInput(patch: Partial<InputState>): void {
    Object.assign(this.input, patch);
  }

  public startRace(): void {
    this.audio.unlock();
    this.resetGrid();
    this.phase = 'countdown';
    this.countdownTimer = 3.2;
    this.lastCountdownBeep = -1;
    this.track.setStartLights('red1');
    this.pushTelemetry(true);
  }

  public pauseRace(): void {
    if (this.phase === 'racing' || this.phase === 'countdown') {
      this.prePausePhase = this.phase;
      this.phase = 'paused';
      this.audio.updateEngine(0, 0, false, false, false);
      this.pushTelemetry(true);
    }
  }

  public resumeRace(): void {
    if (this.phase === 'paused') {
      this.audio.unlock();
      this.phase = this.prePausePhase;
      this.lastTime = performance.now();
      this.pushTelemetry(true);
    }
  }

  public togglePause(): void {
    if (this.phase === 'paused') {
      this.resumeRace();
    } else if (this.phase === 'racing' || this.phase === 'countdown') {
      this.pauseRace();
    }
  }

  public recoverCarToTrack(): void {
    if (this.phase !== 'racing' && this.phase !== 'paused') return;
    const p = this.player;
    const closest = this.track.getClosestTrackPoint(p.x, p.z, p.closestIdx);
    p.closestIdx = closest.sampleIndex;
    p.x = closest.pointOnCenter.x;
    p.z = closest.pointOnCenter.z;
    p.yaw = Math.atan2(-closest.tangent.x, -closest.tangent.z);
    p.vx = 0;
    p.vz = 0;
    p.speed = 0;
    p.steerAngle = 0;
    p.rollAngle = 0;
    p.pitchAngle = 0;
    this.wrongWayTimer = 0;
    p.mesh.group.position.set(p.x, 0.04, p.z);
    p.mesh.group.rotation.set(0, p.yaw, 0);
    p.mesh.updateVisuals(0, 0, false, false, 0, 0, 0.016);
    this.pushTelemetry(true);
  }

  public resetToGrid(): void {
    this.resetGrid();
    this.phase = 'ready';
    this.track.setStartLights('off');
    this.pushTelemetry(true);
  }

  private resetGrid(): void {
    this.raceElapsedMs = 0;
    this.wrongWayTimer = 0;
    this.isGameOver = false;
    this.finishOrderCount = 0;
    this.notifications = [];
    this.sessionNaira = 0;
    this.notesCollectedCount = 0;
    this.podiumBonusNaira = 0;
    this.lastNairaPickupAt = 0;
    this.resetAllNairaPickups();
    this.track.setStartLights('off');

    // Staggered 2x2 grid calibrated in meters behind the start line
    const totalLen = Math.max(100, this.track.totalLength);
    const gridSlots = [
      { meters: 7, lateral: -3.2 },  // P1
      { meters: 14, lateral: 3.2 },  // P2
      { meters: 21, lateral: -3.2 }, // P3
      { meters: 28, lateral: 3.2 },  // P4 (Player)
    ];

    this.racers.forEach((racer, idx) => {
      const slot = gridSlots[idx];
      const slotT = ((1 - slot.meters / totalLen) % 1 + 1) % 1;
      const pt = this.track.curve.getPointAt(slotT);
      const tan = this.track.curve.getTangentAt(slotT).setY(0).normalize();
      const right = new THREE.Vector3(-tan.z, 0, tan.x).normalize();

      racer.x = pt.x + right.x * slot.lateral;
      racer.z = pt.z + right.z * slot.lateral;
      racer.yaw = Math.atan2(-tan.x, -tan.z);
      racer.vx = 0;
      racer.vz = 0;
      racer.speed = 0;
      racer.steerAngle = 0;
      racer.rollAngle = 0;
      racer.pitchAngle = 0;
      racer.nitro = 100;
      racer.isBoosting = false;
      racer.isDrifting = false;
      racer.isBraking = false;
      racer.lastRawT = slotT;
      racer.unwrappedT = slotT - 1.0; // negative so crossing line begins Lap 1 cleanly
      racer.lap = 1;
      racer.lapStartTimeMs = 0;
      racer.bestLapTimeMs = null;
      racer.finished = false;
      racer.finishPosition = null;
      racer.finishTimeMs = null;

      const closest = this.track.getClosestTrackPoint(racer.x, racer.z);
      racer.closestIdx = closest.sampleIndex;

      racer.mesh.group.position.set(racer.x, 0.04, racer.z);
      racer.mesh.group.rotation.set(0, racer.yaw, 0);
      racer.mesh.updateVisuals(0, 0, false, false, 0, 0, 0.016);
    });

    // Snap camera cleanly behind player car on grid
    const fwdX = -Math.sin(this.player.yaw);
    const fwdZ = -Math.cos(this.player.yaw);
    this.cameraPos.set(this.player.x - fwdX * 10.5, 4.4, this.player.z - fwdZ * 10.5);
    this.cameraLookAt.set(this.player.x + fwdX * 12, 1.3, this.player.z + fwdZ * 12);
    this.camera.position.copy(this.cameraPos);
    this.camera.lookAt(this.cameraLookAt);
  }

  private spawnParticle(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    isBoost: boolean,
    customColorHex?: number
  ): void {
    const p = this.particles[this.particleCursor];
    this.particleCursor = (this.particleCursor + 1) % this.particles.length;
    p.active = true;
    p.x = x;
    p.y = y;
    p.z = z;
    p.vx = vx;
    p.vy = vy;
    p.vz = vz;
    p.life = 0;
    p.maxLife = customColorHex !== undefined ? 0.55 : isBoost ? 0.28 : 0.48;
    p.size = customColorHex !== undefined ? 0.85 : isBoost ? 0.65 : 1.05;
    p.colorHex = customColorHex !== undefined ? customColorHex : isBoost ? 0x38bdf8 : 0xdbeafe;
  }

  private updateParticles(dt: number): void {
    let anyChanged = false;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      anyChanged = true;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        _dummy.position.set(0, -50, 0);
        _dummy.scale.setScalar(0.001);
        _dummy.updateMatrix();
        this.particlesMesh.setMatrixAt(i, _dummy.matrix);
        continue;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const ratio = p.life / p.maxLife;
      const s = p.size * (p.colorHex !== 0xdbeafe ? 1 - ratio * 0.65 : 0.6 + ratio * 1.4);

      _dummy.position.set(p.x, p.y, p.z);
      _dummy.scale.setScalar(s);
      _dummy.updateMatrix();
      this.particlesMesh.setMatrixAt(i, _dummy.matrix);

      _color.setHex(p.colorHex);
      this.particlesMesh.setColorAt(i, _color);
    }

    if (anyChanged) {
      this.particlesMesh.instanceMatrix.needsUpdate = true;
      if (this.particlesMesh.instanceColor) this.particlesMesh.instanceColor.needsUpdate = true;
    }
  }

  private updateNairaPickups(dt: number): void {
    const tNow = performance.now() * 0.001;
    const pickupDistSq = 2.85 * 2.85;
    const px = this.player.x;
    const pz = this.player.z;

    for (const note of this.nairaPickups) {
      if (!note.active) {
        if (this.phase === 'racing') {
          note.respawnTimer -= dt;
          if (note.respawnTimer <= 0) {
            note.active = true;
            note.noteMesh.visible = true;
            note.beaconMesh.visible = true;
          }
        }
        continue;
      }

      // Bob & spin visibly above the asphalt
      note.noteMesh.position.y = 0.98 + Math.sin(tNow * 3.4 + note.phaseOffset) * 0.16;
      note.noteMesh.rotation.y += dt * 1.85;
      note.noteMesh.rotation.z = Math.sin(tNow * 2.5 + note.phaseOffset) * 0.1;

      if (this.phase === 'racing') {
        const dx = px - note.x;
        const dz = pz - note.z;
        if (dx * dx + dz * dz <= pickupDistSq) {
          note.active = false;
          note.respawnTimer = 14;
          note.noteMesh.visible = false;
          note.beaconMesh.visible = false;

          this.sessionNaira += 10;
          this.notesCollectedCount += 1;
          this.lastNairaPickupAt = performance.now();
          this.audio.playNairaCollect();
          this.onNairaAwarded?.(10);

          for (let k = 0; k < 8; k++) {
            const ang = (k / 8) * Math.PI * 2;
            this.spawnParticle(
              note.x,
              1.0,
              note.z,
              Math.cos(ang) * 4.5,
              3.2 + Math.random() * 2.5,
              Math.sin(ang) * 4.5,
              true,
              k % 2 === 0 ? 0x10b981 : 0xfbbf24
            );
          }
          this.pushTelemetry(true);
        }
      }
    }
  }

  private updatePlayerPhysics(dt: number): void {
    const p = this.player;
    const fwdX = -Math.sin(p.yaw);
    const fwdZ = -Math.cos(p.yaw);
    const rightX = Math.cos(p.yaw);
    const rightZ = -Math.sin(p.yaw);

    // Project current velocity onto forward & lateral axes
    let forwardVel = p.vx * fwdX + p.vz * fwdZ;
    let lateralVel = p.vx * rightX + p.vz * rightZ;

    const closest = this.track.getClosestTrackPoint(p.x, p.z, p.closestIdx);
    p.closestIdx = closest.sampleIndex;
    const onRoad = closest.distanceFromCenter <= this.track.roadHalfWidth + 1.1;

    // Nitro boost logic (scaled by equipped car nitro efficiency)
    const wantsBoost = this.input.boost && p.nitro > 2 && this.input.throttle;
    p.isBoosting = wantsBoost;
    if (p.isBoosting) {
      p.nitro = Math.max(0, p.nitro - (28 / this.playerCarSpec.nitroMult) * dt);
    } else {
      // Passive slow trickle + bonus charge when drifting
      p.nitro = Math.min(100, p.nitro + (p.isDrifting ? 24 : 3.2) * this.playerCarSpec.nitroMult * dt);
    }

    // Acceleration & Braking (scaled by equipped car speed & accel stats)
    const maxSpeed = ((onRoad ? 65 : 46) * this.playerCarSpec.speedMult) + (p.isBoosting ? 16 : 0);
    const accelForce = ((p.isBoosting ? 58 : 34) * this.playerCarSpec.accelMult) * (onRoad ? 1 : 0.78);
    p.isBraking = false;

    if (this.input.throttle) {
      const accelCurve = Math.max(0.25, 1 - Math.max(0, forwardVel) / (maxSpeed * 1.15));
      forwardVel += accelForce * accelCurve * dt;
    } else if (this.input.brake) {
      if (forwardVel > 2) {
        p.isBraking = true;
        forwardVel -= 52 * dt;
      } else {
        // Reverse gear
        forwardVel = Math.max(-18, forwardVel - 20 * dt);
      }
    } else {
      // Natural aerodynamic & rolling drag
      forwardVel *= Math.exp(-0.95 * dt);
    }

    forwardVel = THREE.MathUtils.clamp(forwardVel, -18, maxSpeed);

    // Steering & Drift Dynamics (respects SteeringStyle: grip | arcade | drift + car handlingMult)
    const digitalSteer = (this.input.left ? 1 : 0) - (this.input.right ? 1 : 0);
    const steerInput =
      digitalSteer !== 0
        ? digitalSteer
        : this.input.analogSteer !== null
          ? THREE.MathUtils.clamp(this.input.analogSteer, -1, 1)
          : 0;
    p.steerAngle = THREE.MathUtils.damp(p.steerAngle, steerInput, 12, dt);

    const speedFactor = THREE.MathUtils.clamp(Math.abs(forwardVel) / 14, 0, 1);
    const highSpeedDamp = 1 - THREE.MathUtils.clamp(Math.abs(forwardVel) / 110, 0, 0.45);
    const reverseSign = forwardVel >= -0.5 ? 1 : -1;

    const autoDrift =
      this.steeringStyle === 'drift' &&
      Math.abs(forwardVel) > 22 &&
      Math.abs(steerInput) > 0.45;
    const isDrifting =
      (this.input.drift || autoDrift) &&
      Math.abs(forwardVel) > 18 &&
      Math.abs(steerInput) > 0.1;
    p.isDrifting = isDrifting;

    const baseTurn =
      this.steeringStyle === 'grip' ? 2.15 : this.steeringStyle === 'drift' ? 2.2 : 1.95;
    const driftTurn =
      this.steeringStyle === 'grip' ? 2.45 : this.steeringStyle === 'drift' ? 2.8 : 2.55;
    const handlingFactor = 0.85 + this.playerCarSpec.handlingMult * 0.15;
    const turnRate =
      (isDrifting ? driftTurn : baseTurn) * this.steeringSensitivity * handlingFactor * speedFactor * highSpeedDamp;
    p.yaw += p.steerAngle * turnRate * reverseSign * dt;

    // Lateral tire grip (tight on Grip, balanced on Arcade, tail-happy on Drift)
    const normalGrip =
      (this.steeringStyle === 'grip' ? 13.5 : this.steeringStyle === 'drift' ? 5.6 : 9.2) *
      this.playerCarSpec.handlingMult;
    const driftGrip =
      (this.steeringStyle === 'grip' ? 4.8 : this.steeringStyle === 'drift' ? 2.1 : 3.2) *
      this.playerCarSpec.handlingMult;
    const gripDecay = isDrifting ? driftGrip : normalGrip;
    lateralVel *= Math.exp(-gripDecay * dt);

    // Reconstruct world velocity along updated heading
    const newFwdX = -Math.sin(p.yaw);
    const newFwdZ = -Math.cos(p.yaw);
    const newRightX = Math.cos(p.yaw);
    const newRightZ = -Math.sin(p.yaw);

    p.vx = newFwdX * forwardVel + newRightX * lateralVel;
    p.vz = newFwdZ * forwardVel + newRightZ * lateralVel;

    p.x += p.vx * dt;
    p.z += p.vz * dt;
    p.speed = Math.hypot(p.vx, p.vz);

    // Guardrail Barrier Collision (keeps car cleanly inside circuit walls)
    const postClosest = this.track.getClosestTrackPoint(p.x, p.z, p.closestIdx);
    p.closestIdx = postClosest.sampleIndex;
    const maxAllowedLateral = this.track.wallHalfWidth - 1.25;
    if (Math.abs(postClosest.signedLateral) > maxAllowedLateral) {
      const sign = Math.sign(postClosest.signedLateral);
      const excess = Math.abs(postClosest.signedLateral) - maxAllowedLateral;
      p.x -= postClosest.right.x * sign * excess;
      p.z -= postClosest.right.z * sign * excess;

      // Scrub outward lateral velocity along barrier normal
      const vDotRight = p.vx * postClosest.right.x + p.vz * postClosest.right.z;
      if (vDotRight * sign > 0) {
        p.vx -= postClosest.right.x * vDotRight * 1.15;
        p.vz -= postClosest.right.z * vDotRight * 1.15;
        p.vx *= 0.88;
        p.vz *= 0.88;
      }
    }

    // Wrong-way check
    const alignDot = newFwdX * postClosest.tangent.x + newFwdZ * postClosest.tangent.z;
    if (alignDot < -0.35 && forwardVel > 4) {
      this.wrongWayTimer += dt;
    } else {
      this.wrongWayTimer = 0;
    }

    // Suspension roll & pitch visual feedback
    const targetRoll = THREE.MathUtils.clamp(-lateralVel * 0.012 + p.steerAngle * 0.04, -0.1, 0.1);
    const targetPitch = this.input.throttle && forwardVel > 5 ? -0.025 : p.isBraking ? 0.045 : 0;
    p.rollAngle = THREE.MathUtils.damp(p.rollAngle, targetRoll, 10, dt);
    p.pitchAngle = THREE.MathUtils.damp(p.pitchAngle, targetPitch, 10, dt);

    // Drift tire smoke & boost sparks
    if ((p.isDrifting || Math.abs(lateralVel) > 8) && Math.random() < 0.65) {
      this.spawnParticle(
        p.x - newFwdX * 1.5 + (Math.random() - 0.5) * 1.4,
        0.22,
        p.z - newFwdZ * 1.5 + (Math.random() - 0.5) * 1.4,
        (Math.random() - 0.5) * 2,
        1.2 + Math.random() * 1.2,
        (Math.random() - 0.5) * 2,
        false
      );
    } else if (p.isBoosting && Math.random() < 0.75) {
      this.spawnParticle(
        p.x - newFwdX * 2.3,
        0.35,
        p.z - newFwdZ * 2.3,
        -newFwdX * 10 + (Math.random() - 0.5) * 2,
        0.6,
        -newFwdZ * 10 + (Math.random() - 0.5) * 2,
        true
      );
    }

    p.mesh.group.position.set(p.x, 0.04, p.z);
    p.mesh.group.rotation.set(0, p.yaw, 0);
    p.mesh.updateVisuals(forwardVel, p.steerAngle, p.isBraking, p.isBoosting, p.rollAngle, p.pitchAngle, dt);
  }

  private updateAiRacer(r: RacerEntity, dt: number): void {
    const samples = this.track.samples;
    const count = samples.length;

    const closest = this.track.getClosestTrackPoint(r.x, r.z, r.closestIdx);
    r.closestIdx = closest.sampleIndex;

    // Look ahead ~28m and ~56m regardless of circuit length (1,050m to 4,500m)
    const segmentMeters = this.track.totalLength / count;
    const lookSteps = Math.max(6, Math.round(28 / segmentMeters));
    const farSteps = Math.max(12, Math.round(56 / segmentMeters));
    const targetIdx = (closest.sampleIndex + lookSteps) % count;
    const farIdx = (closest.sampleIndex + farSteps) % count;
    const targetSample = samples[targetIdx];
    const farSample = samples[farIdx];

    // Measure upcoming corner sharpness to modulate AI speed realistically
    const cornerDot = closest.tangent.dot(farSample.tangent);
    const cornerFactor = THREE.MathUtils.clamp((cornerDot + 0.2) / 1.2, 0.58, 1.0);

    const diffMultiplier = this.difficulty === 'pro' ? 1.04 : 0.91;
    // Gentle rubber-banding calibrated in meters so races stay engaging across all circuit lengths
    const gapMeters = (this.player.unwrappedT - r.unwrappedT) * this.track.totalLength;
    const rubberBand = THREE.MathUtils.clamp(gapMeters * 0.018, -3.5, 4.5);

    const desiredSpeed = (59 * r.aiBaseSkill * diffMultiplier * cornerFactor) + rubberBand;

    // Target world position with lane offset
    _vecA.copy(targetSample.point).addScaledVector(targetSample.right, r.aiLaneOffset);

    const dx = _vecA.x - r.x;
    const dz = _vecA.z - r.z;
    const desiredYaw = Math.atan2(-dx, -dz);

    let yawDiff = desiredYaw - r.yaw;
    while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
    while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;

    const steerCmd = THREE.MathUtils.clamp(yawDiff * 2.2, -1, 1);
    r.steerAngle = THREE.MathUtils.damp(r.steerAngle, steerCmd, 10, dt);
    r.yaw += steerCmd * 2.4 * dt;

    if (r.speed < desiredSpeed) {
      r.speed = Math.min(desiredSpeed, r.speed + 28 * dt);
      r.isBraking = false;
    } else {
      r.speed = Math.max(desiredSpeed, r.speed - 30 * dt);
      r.isBraking = r.speed - desiredSpeed > 5;
    }

    r.isBoosting = gapMeters > 120 && cornerFactor > 0.92;
    if (r.isBoosting) {
      r.speed = Math.min(72, r.speed + 12 * dt);
    }

    const fwdX = -Math.sin(r.yaw);
    const fwdZ = -Math.cos(r.yaw);
    r.vx = fwdX * r.speed;
    r.vz = fwdZ * r.speed;
    r.x += r.vx * dt;
    r.z += r.vz * dt;

    r.rollAngle = THREE.MathUtils.damp(r.rollAngle, THREE.MathUtils.clamp(steerCmd * 0.055, -0.08, 0.08), 8, dt);
    r.mesh.group.position.set(r.x, 0.04, r.z);
    r.mesh.group.rotation.set(0, r.yaw, 0);
    r.mesh.updateVisuals(r.speed, r.steerAngle, r.isBraking, r.isBoosting, r.rollAngle, 0, dt);
  }

  private resolveCarCollisions(): void {
    const minDist = 2.45;
    const minDistSq = minDist * minDist;

    for (let i = 0; i < this.racers.length; i++) {
      for (let j = i + 1; j < this.racers.length; j++) {
        const a = this.racers[i];
        const b = this.racers[j];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const dSq = dx * dx + dz * dz;
        if (dSq > 0.0001 && dSq < minDistSq) {
          const dist = Math.sqrt(dSq);
          const nx = dx / dist;
          const nz = dz / dist;
          const overlap = (minDist - dist) * 0.5;

          a.x -= nx * overlap;
          a.z -= nz * overlap;
          b.x += nx * overlap;
          b.z += nz * overlap;

          // Exchange mild impulse
          const relVx = b.vx - a.vx;
          const relVz = b.vz - a.vz;
          const sepVel = relVx * nx + relVz * nz;
          if (sepVel < 0) {
            const impulse = -sepVel * 0.55;
            a.vx -= nx * impulse;
            a.vz -= nz * impulse;
            b.vx += nx * impulse;
            b.vz += nz * impulse;
          }
        }
      }
    }
  }

  private updateLapProgress(r: RacerEntity): void {
    const currentT = this.track.samples[r.closestIdx].t;
    let deltaT = currentT - r.lastRawT;
    if (deltaT < -0.5) deltaT += 1.0;
    if (deltaT > 0.5) deltaT -= 1.0;

    r.unwrappedT += deltaT;
    r.lastRawT = currentT;

    if (!r.finished && r.unwrappedT >= this.totalLaps) {
      this.finishOrderCount += 1;
      r.finished = true;
      r.finishPosition = this.finishOrderCount;
      r.finishTimeMs = this.raceElapsedMs;
      const lapDuration = this.raceElapsedMs - r.lapStartTimeMs;
      if (r.bestLapTimeMs === null || lapDuration < r.bestLapTimeMs) {
        r.bestLapTimeMs = lapDuration;
      }

      if (!r.isPlayer) {
        this.notifications.push({
          id: `${r.id}-${this.finishOrderCount}-${Date.now()}`,
          racerId: r.id,
          name: r.name,
          colorHex: r.colorHex,
          position: this.finishOrderCount,
          finishTimeMs: this.raceElapsedMs,
          timestamp: performance.now(),
        });

        // Once another car wins (finishes 1st before the player), end the game immediately
        if (!this.player.finished) {
          this.isGameOver = true;
          this.phase = 'finished';
          this.audio.playGameOverTone();
        } else {
          this.audio.playOpponentFinishChime();
        }
        this.pushTelemetry(true);
      } else {
        this.isGameOver = this.finishOrderCount > 1;
        this.phase = 'finished';
        if (this.isGameOver) {
          this.audio.playGameOverTone();
        } else {
          this.audio.playFinishFanfare();
        }
        // Podium bonus Naira for finishing P1..P3
        const bonus =
          this.finishOrderCount === 1
            ? 100
            : this.finishOrderCount === 2
              ? 50
              : this.finishOrderCount === 3
                ? 25
                : 0;
        if (bonus > 0) {
          this.podiumBonusNaira = bonus;
          this.sessionNaira += bonus;
          this.onNairaAwarded?.(bonus);
        }
        this.pushTelemetry(true);
      }
      return;
    }

    const computedLap = Math.max(1, Math.min(this.totalLaps, Math.floor(r.unwrappedT) + 1));
    if (computedLap > r.lap) {
      const lapDuration = this.raceElapsedMs - r.lapStartTimeMs;
      if (r.lapStartTimeMs > 0 || r.lap >= 1) {
        if (r.bestLapTimeMs === null || lapDuration < r.bestLapTimeMs) {
          r.bestLapTimeMs = lapDuration;
        }
      }
      r.lap = computedLap;
      r.lapStartTimeMs = this.raceElapsedMs;
      if (r.isPlayer) {
        this.audio.playLapChime();
        this.resetAllNairaPickups();
      }
    }
  }

  private updateCamera(dt: number): void {
    const p = this.player;
    const fwdX = -Math.sin(p.yaw);
    const fwdZ = -Math.cos(p.yaw);

    if (this.phase === 'ready') {
      // Gentle showcase orbit around the starting grid
      const t = performance.now() * 0.00025;
      const targetPosX = p.x - fwdX * 9.5 + Math.sin(t) * 3.8;
      const targetPosZ = p.z - fwdZ * 9.5 + Math.cos(t) * 2.0;
      this.cameraPos.x = THREE.MathUtils.damp(this.cameraPos.x, targetPosX, 4, dt);
      this.cameraPos.y = THREE.MathUtils.damp(this.cameraPos.y, 4.1, 4, dt);
      this.cameraPos.z = THREE.MathUtils.damp(this.cameraPos.z, targetPosZ, 4, dt);
      this.cameraLookAt.set(p.x + fwdX * 8, 1.4, p.z + fwdZ * 8);
      this.camera.position.copy(this.cameraPos);
      this.camera.lookAt(this.cameraLookAt);
      this.currentFov = THREE.MathUtils.damp(this.currentFov, 58, 6, dt);
      this.camera.fov = this.currentFov;
      this.camera.updateProjectionMatrix();
      return;
    }

    if (this.cameraMode === 'hood') {
      _vecB.set(p.x - fwdX * 0.2, 1.38, p.z - fwdZ * 0.2);
      _vecC.set(p.x + fwdX * 22, 1.05, p.z + fwdZ * 22);
      this.cameraPos.lerp(_vecB, 1 - Math.exp(-24 * dt));
      this.cameraLookAt.lerp(_vecC, 1 - Math.exp(-24 * dt));
    } else {
      const distBack = this.cameraMode === 'far' ? 12.6 : 8.8;
      const height = this.cameraMode === 'far' ? 4.8 : 3.45;
      _vecB.set(p.x - fwdX * distBack, height, p.z - fwdZ * distBack);
      _vecC.set(p.x + fwdX * 14, 1.35, p.z + fwdZ * 14);

      const posLambda = this.cameraMode === 'far' ? 8 : 11;
      this.cameraPos.x = THREE.MathUtils.damp(this.cameraPos.x, _vecB.x, posLambda, dt);
      this.cameraPos.y = THREE.MathUtils.damp(this.cameraPos.y, _vecB.y, posLambda, dt);
      this.cameraPos.z = THREE.MathUtils.damp(this.cameraPos.z, _vecB.z, posLambda, dt);

      this.cameraLookAt.x = THREE.MathUtils.damp(this.cameraLookAt.x, _vecC.x, 14, dt);
      this.cameraLookAt.y = THREE.MathUtils.damp(this.cameraLookAt.y, _vecC.y, 14, dt);
      this.cameraLookAt.z = THREE.MathUtils.damp(this.cameraLookAt.z, _vecC.z, 14, dt);
    }

    this.camera.position.copy(this.cameraPos);
    this.camera.lookAt(this.cameraLookAt);

    // Speed-responsive FOV widening & subtle corner tilt
    const speedRatio = THREE.MathUtils.clamp(p.speed / 72, 0, 1);
    const targetFov = (this.cameraMode === 'hood' ? 68 : 61) + speedRatio * 12 + (p.isBoosting ? 5 : 0);
    this.currentFov = THREE.MathUtils.damp(this.currentFov, targetFov, 7, dt);
    this.camera.fov = this.currentFov;
    this.camera.updateProjectionMatrix();

    const targetCamRoll = this.cameraMode === 'hood' ? p.steerAngle * 0.02 : -p.steerAngle * 0.025 * speedRatio;
    this.camRoll = THREE.MathUtils.damp(this.camRoll, targetCamRoll, 8, dt);
    this.camera.rotation.z += this.camRoll;

    // Keep tight directional shadow frustum centered on player car
    if (!this.isSoftwareGl) {
      this.sunLight.position.set(p.x + 55, 85, p.z + 45);
      this.sunLight.target.position.set(p.x, 0, p.z);
      this.sunLight.target.updateMatrixWorld();
    }
  }

  private getGearAndRpm(speedKmh: number): { gear: string; rpmRatio: number } {
    if (this.player.isBraking && speedKmh < 5) {
      return { gear: 'R', rpmRatio: 0.35 };
    }
    if (speedKmh < 4) return { gear: 'N', rpmRatio: 0.16 };
    const thresholds = [0, 48, 92, 138, 184, 232, 310];
    for (let g = 1; g < thresholds.length; g++) {
      if (speedKmh <= thresholds[g] || g === thresholds.length - 1) {
        const low = thresholds[g - 1];
        const high = thresholds[g];
        const ratio = THREE.MathUtils.clamp((speedKmh - low) / (high - low), 0.25, 0.98);
        return { gear: String(g), rpmRatio: ratio };
      }
    }
    return { gear: '6', rpmRatio: 0.95 };
  }

  private pushTelemetry(force = false): void {
    const now = performance.now();
    if (!force && now - this.lastTelemetryPush < 50) return;
    this.lastTelemetryPush = now;

    // Sort standings: finished racers by finishPosition, active racers by unwrappedT descending
    const sorted = [...this.racers].sort((a, b) => {
      if (a.finished && b.finished) {
        return (a.finishPosition ?? 99) - (b.finishPosition ?? 99);
      }
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.unwrappedT - a.unwrappedT;
    });

    // Keep finish notifications visible for 5 seconds
    this.notifications = this.notifications.filter((n) => now - n.timestamp < 5000);

    const standings: RacerStandingsEntry[] = sorted.map((r, idx) => ({
      id: r.id,
      name: r.name,
      colorHex: r.colorHex,
      isPlayer: r.isPlayer,
      position: idx + 1,
      lap: r.lap,
      totalProgress: r.unwrappedT,
      finished: r.finished,
      finishTimeMs: r.finishTimeMs,
    }));

    const playerPos = standings.find((s) => s.isPlayer)?.position ?? 4;
    const speedKmh = Math.round(this.player.speed * 3.6);
    const { gear, rpmRatio } = this.getGearAndRpm(speedKmh);

    const minimapMarkers: MinimapMarker[] = this.racers.map((r) => {
      const norm = this.track.normalizeToMinimap(r.x, r.z);
      return {
        id: r.id,
        x: norm.x,
        y: norm.y,
        colorHex: r.colorHex,
        isPlayer: r.isPlayer,
      };
    });

    this.onTelemetry({
      phase: this.phase,
      trackId: this.trackId,
      trackName: this.track.preset.name,
      trackLengthMeters: Math.round(this.track.totalLength),
      countdownValue: Math.max(0, Math.ceil(this.countdownTimer)),
      speedKmh,
      gear,
      rpmRatio,
      nitro: Math.round(this.player.nitro),
      isBoosting: this.player.isBoosting,
      isDrifting: this.player.isDrifting,
      lap: this.player.lap,
      totalLaps: this.totalLaps,
      position: playerPos,
      totalRacers: this.racers.length,
      raceTimeMs: this.raceElapsedMs,
      currentLapTimeMs: Math.max(0, this.raceElapsedMs - this.player.lapStartTimeMs),
      bestLapTimeMs: this.player.bestLapTimeMs,
      standings,
      minimapMarkers,
      wrongWay: this.wrongWayTimer > 0.65,
      steerAxis: this.player.steerAngle,
      isGameOver: this.isGameOver,
      notifications: [...this.notifications],
      sessionNaira: this.sessionNaira,
      notesCollectedCount: this.notesCollectedCount,
      podiumBonusNaira: this.podiumBonusNaira,
      lastNairaPickupAt: this.lastNairaPickupAt,
    });
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private tick = (): void => {
    if (this.disposed) return;

    const now = performance.now();
    const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTime) / 1000));
    this.lastTime = now;

    if (!this.contextLost) {
      if (this.phase === 'countdown') {
        this.countdownTimer -= dt;
        const step = Math.ceil(this.countdownTimer);
        if (step !== this.lastCountdownBeep && step >= 1 && step <= 3) {
          this.lastCountdownBeep = step;
          this.audio.playCountdownBeep(false);
          this.track.setStartLights(step === 3 ? 'red1' : step === 2 ? 'red2' : 'red3');
        }
        if (this.countdownTimer <= 0) {
          this.phase = 'racing';
          this.audio.playCountdownBeep(true);
          this.track.setStartLights('go');
          window.setTimeout(() => {
            if (!this.disposed) this.track.setStartLights('off');
          }, 1600);
        }
        // Subtle revving on grid
        const revving = this.input.throttle ? 0.65 : 0.22;
        this.audio.updateEngine(0.1, revving, false, false, true);
      } else if (this.phase === 'racing') {
        this.raceElapsedMs += dt * 1000;
        this.updatePlayerPhysics(dt);
        for (const r of this.racers) {
          if (!r.isPlayer) {
            this.updateAiRacer(r, dt);
          }
        }
        this.resolveCarCollisions();
        for (const r of this.racers) {
          if (this.phase !== 'racing') break;
          this.updateLapProgress(r);
        }
        const speedKmh = this.player.speed * 3.6;
        const { rpmRatio } = this.getGearAndRpm(speedKmh);
        this.audio.updateEngine(
          THREE.MathUtils.clamp(this.player.speed / 70, 0, 1),
          rpmRatio,
          this.player.isDrifting,
          this.player.isBoosting,
          true
        );
      } else if (this.phase === 'finished') {
        // AI cars coast / keep cruising gently after player finishes
        for (const r of this.racers) {
          if (!r.isPlayer) {
            this.updateAiRacer(r, dt);
          } else {
            // Player car coasts down smoothly
            r.vx *= Math.exp(-1.8 * dt);
            r.vz *= Math.exp(-1.8 * dt);
            r.x += r.vx * dt;
            r.z += r.vz * dt;
            r.speed = Math.hypot(r.vx, r.vz);
            r.mesh.group.position.set(r.x, 0.04, r.z);
            r.mesh.updateVisuals(r.speed, 0, false, false, 0, 0, dt);
          }
        }
        this.audio.updateEngine(0, 0.15, false, false, false);
      } else if (this.phase === 'paused') {
        this.audio.updateEngine(0, 0, false, false, false);
      } else {
        this.audio.updateEngine(0, 0, false, false, false);
      }

      if (this.phase !== 'paused') {
        this.updateNairaPickups(dt);
        this.updateParticles(dt);
        this.updateCamera(dt);
      }
      this.renderer.render(this.scene, this.camera);
      this.pushTelemetry();
    }

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  public getMinimapPathPoints(): Array<{ x: number; y: number }> {
    return this.track.minimapPathPoints;
  }

  private handleResize = (): void => {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
  };

  private handleContextLost = (e: Event): void => {
    e.preventDefault();
    this.contextLost = true;
    this.onContextLostChange?.(true);
  };

  private handleContextRestored = (): void => {
    this.contextLost = false;
    this.onContextLostChange?.(false);
  };

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('resize', this.handleResize);
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('webglcontextlost', this.handleContextLost);
    canvas.removeEventListener('webglcontextrestored', this.handleContextRestored);

    this.audio.dispose();
    this.track.dispose();
    this.textures.dispose();
    for (const r of this.racers) {
      r.mesh.dispose();
    }
    this.nairaNoteGeo.dispose();
    this.nairaNoteMat.dispose();
    this.nairaBeaconGeo.dispose();
    this.nairaBeaconMat.dispose();
    this.particlesMesh.geometry.dispose();
    (this.particlesMesh.material as THREE.Material).dispose();
    this.renderer.dispose();

    if (canvas.parentElement === this.container) {
      this.container.removeChild(canvas);
    }
  }
}
