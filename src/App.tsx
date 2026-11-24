/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { RaceHUD } from './components/RaceHUD';
import { RacingEngine } from './game/RacingEngine';
import { useGarageStore } from './hooks/useGarageStore';
import { useMobileLandscape } from './hooks/useMobileLandscape';
import {
  CameraMode,
  CarSpec,
  Difficulty,
  InputState,
  LIVERY_OPTIONS,
  LiveryOption,
  RaceTelemetry,
  SteeringInputMode,
  SteeringStyle,
  TrackId,
} from './game/types';

const INITIAL_TELEMETRY: RaceTelemetry = {
  phase: 'ready',
  trackId: 'alpine',
  trackName: 'Alpine Club',
  trackLengthMeters: 1050,
  countdownValue: 3,
  speedKmh: 0,
  gear: 'N',
  rpmRatio: 0,
  nitro: 100,
  isBoosting: false,
  isDrifting: false,
  lap: 1,
  totalLaps: 3,
  position: 4,
  totalRacers: 4,
  raceTimeMs: 0,
  currentLapTimeMs: 0,
  bestLapTimeMs: null,
  standings: [],
  minimapMarkers: [],
  wrongWay: false,
  steerAxis: 0,
  isGameOver: false,
  notifications: [],
  sessionNaira: 0,
  notesCollectedCount: 0,
  podiumBonusNaira: 0,
  lastNairaPickupAt: 0,
};

interface DeviceOrientationEventWithPermission {
  requestPermission?: () => Promise<'granted' | 'denied'>;
}

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<RacingEngine | null>(null);

  const {
    nairaBalance,
    unlockedCarIds,
    selectedCar,
    addNaira,
    buyCar,
    selectCar,
  } = useGarageStore();

  const addNairaRef = useRef(addNaira);
  addNairaRef.current = addNaira;

  const initialCarRef = useRef(selectedCar);

  const {
    isTouchDevice,
    isIOS,
    isApkApp,
    isPortrait,
    canLockOrientation,
    portraitDismissed,
    dismissPortraitPrompt,
    requestLandscape,
  } = useMobileLandscape();

  const [telemetry, setTelemetry] = useState<RaceTelemetry>(INITIAL_TELEMETRY);
  const [minimapPath, setMinimapPath] = useState<Array<{ x: number; y: number }>>([]);
  const [selectedTrackId, setSelectedTrackId] = useState<TrackId>('alpine');
  const [selectedLivery, setSelectedLivery] = useState<LiveryOption>(LIVERY_OPTIONS[0]);
  const [difficulty, setDifficulty] = useState<Difficulty>('casual');
  const [laps, setLaps] = useState<number>(3);
  const [steeringStyle, setSteeringStyle] = useState<SteeringStyle>('arcade');
  const [steeringInput, setSteeringInput] = useState<SteeringInputMode>(() =>
    isTouchDevice || isApkApp ? 'onscreen' : 'keyboard'
  );
  const [steeringSensitivity, setSteeringSensitivity] = useState<number>(1.0);
  const [volume, setVolume] = useState<number>(0.7);
  const [cameraMode, setCameraMode] = useState<CameraMode>('chase');
  const [muted, setMuted] = useState(false);
  const [hudCollapsed, setHudCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [trackSelectOpen, setTrackSelectOpen] = useState(false);
  const [garageOpen, setGarageOpen] = useState(false);
  const [tiltError, setTiltError] = useState<string | null>(null);
  const [contextLost, setContextLost] = useState(false);

  // Never keep keyboard/mouse steering selected in Android APK or touch devices
  useEffect(() => {
    if ((isApkApp || isTouchDevice) && (steeringInput === 'keyboard' || steeringInput === 'mouse')) {
      setSteeringInput('onscreen');
    }
  }, [isApkApp, isTouchDevice, steeringInput]);

  // Initialize Three.js WebGL RacingEngine once inside isolated ref container
  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const engine = new RacingEngine(
      mount,
      (t) => setTelemetry(t),
      (lost) => setContextLost(lost),
      (amount) => addNairaRef.current(amount)
    );
    engine.setPlayerCar(initialCarRef.current, LIVERY_OPTIONS[0]);
    engineRef.current = engine;
    setMinimapPath(engine.getMinimapPathPoints());

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  // Keyboard input bindings
  useEffect(() => {
    const handleKey = (e: KeyboardEvent, down: boolean) => {
      const engine = engineRef.current;
      if (!engine) return;

      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          engine.setInput({ throttle: down });
          break;
        case 'KeyS':
        case 'ArrowDown':
          engine.setInput({ brake: down });
          break;
        case 'KeyA':
        case 'ArrowLeft':
          engine.setInput({ left: down });
          break;
        case 'KeyD':
        case 'ArrowRight':
          engine.setInput({ right: down });
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          engine.setInput({ drift: down });
          break;
        case 'Space':
          e.preventDefault();
          engine.setInput({ boost: down });
          break;
        case 'KeyC':
          if (down && !e.repeat) {
            const next = engine.cycleCameraMode();
            setCameraMode(next);
          }
          break;
        case 'KeyH':
          if (down && !e.repeat) {
            setHudCollapsed((prev) => !prev);
          }
          break;
        case 'KeyP':
        case 'Escape':
          if (down && !e.repeat) {
            setSettingsOpen(false);
            setTrackSelectOpen(false);
            setGarageOpen(false);
            engine.togglePause();
          }
          break;
        case 'KeyR':
          if (down && !e.repeat) {
            setSettingsOpen(false);
            setTrackSelectOpen(false);
            setGarageOpen(false);
            engine.startRace();
          }
          break;
        case 'KeyF':
          if (down && !e.repeat) {
            engine.recoverCarToTrack();
          }
          break;
      }
    };

    const onKeyDown = (e: KeyboardEvent) => handleKey(e, true);
    const onKeyUp = (e: KeyboardEvent) => handleKey(e, false);
    const onBlur = () => {
      engineRef.current?.setInput({
        throttle: false,
        brake: false,
        left: false,
        right: false,
        drift: false,
        boost: false,
        analogSteer: null,
      });
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  // Mouse Steering listener when steeringInput === 'mouse' (desktop only)
  useEffect(() => {
    const engine = engineRef.current;
    if (steeringInput !== 'mouse' || isApkApp || isTouchDevice) {
      if (steeringInput !== 'tilt') {
        engine?.setInput({ analogSteer: null });
      }
      return;
    }

    const onMouseMove = (e: MouseEvent) => {
      if (settingsOpen || trackSelectOpen || garageOpen) return;
      const halfW = window.innerWidth * 0.5 || 1;
      const normX = (e.clientX - halfW) / (halfW * 0.65);
      const clamped = Math.max(-1, Math.min(1, normX));
      const deadzone = 0.05;
      const steer = Math.abs(clamped) < deadzone ? 0 : -clamped;
      engineRef.current?.setInput({ analogSteer: steer });
    };

    const onMouseDown = (e: MouseEvent) => {
      if (settingsOpen || trackSelectOpen || garageOpen) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('button, input, a')) return;
      if (e.button === 0) engineRef.current?.setInput({ throttle: true });
      if (e.button === 2) engineRef.current?.setInput({ brake: true });
    };

    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) engineRef.current?.setInput({ throttle: false });
      if (e.button === 2) engineRef.current?.setInput({ brake: false });
    };

    const onContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest('button, input, a')) {
        e.preventDefault();
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('contextmenu', onContextMenu);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('contextmenu', onContextMenu);
      engineRef.current?.setInput({ analogSteer: null, throttle: false, brake: false });
    };
  }, [steeringInput, settingsOpen, trackSelectOpen, garageOpen, isApkApp, isTouchDevice]);

  // Device Tilt Steering listener when steeringInput === 'tilt'
  useEffect(() => {
    if (steeringInput !== 'tilt') {
      if (steeringInput !== 'mouse') {
        engineRef.current?.setInput({ analogSteer: null });
      }
      return;
    }

    const onOrientation = (e: DeviceOrientationEvent) => {
      if (settingsOpen || trackSelectOpen || garageOpen) return;
      const beta = typeof e.beta === 'number' ? e.beta : 0;
      const gamma = typeof e.gamma === 'number' ? e.gamma : 0;

      const winOrientation = (window as unknown as { orientation?: number }).orientation;
      const angle =
        typeof screen !== 'undefined' && typeof screen.orientation?.angle === 'number'
          ? screen.orientation.angle
          : typeof winOrientation === 'number'
            ? winOrientation
            : window.innerWidth >= window.innerHeight
              ? 90
              : 0;

      // Positive steer = Left (+1), Negative steer = Right (-1)
      let tiltDeg = 0;
      const normAngle = ((angle % 360) + 360) % 360;
      if (normAngle === 90) {
        tiltDeg = -beta;
      } else if (normAngle === 270) {
        tiltDeg = beta;
      } else if (normAngle === 180) {
        tiltDeg = gamma;
      } else {
        tiltDeg = -gamma;
      }

      const deadzone = 4;
      const maxRange = 26;
      const absDeg = Math.abs(tiltDeg);
      if (absDeg <= deadzone) {
        engineRef.current?.setInput({ analogSteer: 0 });
        return;
      }
      const magnitude = Math.min(1, (absDeg - deadzone) / maxRange);
      const steer = Math.sign(tiltDeg) * magnitude;
      engineRef.current?.setInput({ analogSteer: steer });
    };

    window.addEventListener('deviceorientation', onOrientation);
    return () => {
      window.removeEventListener('deviceorientation', onOrientation);
      engineRef.current?.setInput({ analogSteer: null });
    };
  }, [steeringInput, settingsOpen, trackSelectOpen, garageOpen]);

  const handleSelectTrack = useCallback((trackId: TrackId) => {
    setSelectedTrackId(trackId);
    const engine = engineRef.current;
    if (!engine) return;
    engine.setTrack(trackId);
    setMinimapPath(engine.getMinimapPathPoints());
  }, []);

  const handleSelectLivery = useCallback((livery: LiveryOption) => {
    setSelectedLivery(livery);
    engineRef.current?.setPlayerLivery(livery);
  }, []);

  const handleSelectCar = useCallback((car: CarSpec) => {
    const picked = selectCar(car.id);
    if (!picked) return;
    setSelectedLivery(LIVERY_OPTIONS[0]);
    engineRef.current?.setPlayerCar(picked, LIVERY_OPTIONS[0]);
  }, [selectCar]);

  const handleBuyCar = useCallback(
    (car: CarSpec) => {
      const res = buyCar(car.id);
      if (res.ok && res.car) {
        setSelectedLivery(LIVERY_OPTIONS[0]);
        engineRef.current?.setPlayerCar(res.car, LIVERY_OPTIONS[0]);
        engineRef.current?.playPurchaseSound();
      }
    },
    [buyCar]
  );

  const handleSelectDifficulty = useCallback((diff: Difficulty) => {
    setDifficulty(diff);
    engineRef.current?.setDifficulty(diff);
  }, []);

  const handleSelectLaps = useCallback((count: number) => {
    setLaps(count);
    engineRef.current?.setLaps(count);
  }, []);

  const handleSelectSteeringStyle = useCallback((style: SteeringStyle) => {
    setSteeringStyle(style);
    engineRef.current?.setSteeringStyle(style);
  }, []);

  const handleSelectSteeringInput = useCallback(async (mode: SteeringInputMode) => {
    setTiltError(null);
    if (mode === 'tilt') {
      if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) {
        setTiltError('Tilt sensors are not available on this device.');
        return;
      }
      const DevOrient = window.DeviceOrientationEvent as unknown as DeviceOrientationEventWithPermission;
      if (typeof DevOrient?.requestPermission === 'function') {
        try {
          const result = await DevOrient.requestPermission();
          if (result !== 'granted') {
            setTiltError('Motion permission denied. Using touch buttons.');
            setSteeringInput('onscreen');
            return;
          }
        } catch {
          setTiltError('Could not access tilt sensor.');
          setSteeringInput('onscreen');
          return;
        }
      }
    }
    setSteeringInput(mode);
  }, []);

  const handleSelectSensitivity = useCallback((sens: number) => {
    setSteeringSensitivity(sens);
    engineRef.current?.setSteeringSensitivity(sens);
  }, []);

  const handleChangeVolume = useCallback(
    (vol: number) => {
      setVolume(vol);
      if (vol > 0 && muted) {
        setMuted(false);
        engineRef.current?.setMuted(false);
      } else if (vol === 0 && !muted) {
        setMuted(true);
        engineRef.current?.setMuted(true);
      }
      engineRef.current?.setVolume(vol);
    },
    [muted]
  );

  const handleSelectCamera = useCallback((mode: CameraMode) => {
    setCameraMode(mode);
    engineRef.current?.setCameraMode(mode);
  }, []);

  const handleToggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      engineRef.current?.setMuted(next);
      return next;
    });
  }, []);

  const handleToggleSettings = useCallback(() => {
    setTrackSelectOpen(false);
    setGarageOpen(false);
    setSettingsOpen((prev) => {
      const next = !prev;
      if (next && (telemetry.phase === 'racing' || telemetry.phase === 'countdown')) {
        engineRef.current?.pauseRace();
      }
      return next;
    });
  }, [telemetry.phase]);

  const handleToggleTrackSelect = useCallback(() => {
    setSettingsOpen(false);
    setGarageOpen(false);
    setTrackSelectOpen((prev) => {
      const next = !prev;
      if (next && (telemetry.phase === 'racing' || telemetry.phase === 'countdown')) {
        engineRef.current?.pauseRace();
      }
      return next;
    });
  }, [telemetry.phase]);

  const handleToggleGarage = useCallback(() => {
    setSettingsOpen(false);
    setTrackSelectOpen(false);
    setGarageOpen((prev) => {
      const next = !prev;
      if (next && (telemetry.phase === 'racing' || telemetry.phase === 'countdown')) {
        engineRef.current?.pauseRace();
      }
      return next;
    });
  }, [telemetry.phase]);

  const handleStartRace = useCallback(() => {
    setSettingsOpen(false);
    setTrackSelectOpen(false);
    setGarageOpen(false);
    if (isTouchDevice) {
      void requestLandscape();
    }
    engineRef.current?.startRace();
  }, [isTouchDevice, requestLandscape]);

  const handlePauseRace = useCallback(() => {
    engineRef.current?.pauseRace();
  }, []);

  const handleResumeRace = useCallback(() => {
    setSettingsOpen(false);
    setTrackSelectOpen(false);
    setGarageOpen(false);
    engineRef.current?.resumeRace();
  }, []);

  const handleRestartRace = useCallback(() => {
    setSettingsOpen(false);
    setTrackSelectOpen(false);
    setGarageOpen(false);
    engineRef.current?.startRace();
  }, []);

  const handleBackToGrid = useCallback(() => {
    setSettingsOpen(false);
    setTrackSelectOpen(false);
    setGarageOpen(false);
    engineRef.current?.resetToGrid();
  }, []);

  const handleRecoverCar = useCallback(() => {
    engineRef.current?.recoverCarToTrack();
    engineRef.current?.resumeRace();
  }, []);

  const handleTouchInput = useCallback((patch: Partial<InputState>) => {
    engineRef.current?.setInput(patch);
  }, []);

  return (
    <div className="relative w-[100dvw] h-[100dvh] overflow-hidden bg-[#0a0c10]">
      {/* Dedicated isolated WebGL canvas mount */}
      <div ref={canvasMountRef} className="absolute inset-0 w-full h-full" />

      {contextLost && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#0a0c10]/95 text-center p-6">
          <div className="max-w-sm border border-white/10 rounded-2xl p-6 bg-slate-900">
            <h2 className="font-display text-xl font-bold text-white">Graphics Context Paused</h2>
            <p className="text-sm text-slate-400 mt-2">
              Your browser temporarily paused WebGL rendering. Reload the page if it does not resume automatically.
            </p>
          </div>
        </div>
      )}

      <RaceHUD
        telemetry={telemetry}
        minimapPath={minimapPath}
        selectedTrackId={selectedTrackId}
        selectedLivery={selectedLivery}
        selectedCar={selectedCar}
        unlockedCarIds={unlockedCarIds}
        nairaBalance={nairaBalance}
        difficulty={difficulty}
        laps={laps}
        steeringStyle={steeringStyle}
        steeringInput={steeringInput}
        steeringSensitivity={steeringSensitivity}
        volume={volume}
        cameraMode={cameraMode}
        muted={muted}
        hudCollapsed={hudCollapsed}
        settingsOpen={settingsOpen}
        trackSelectOpen={trackSelectOpen}
        garageOpen={garageOpen}
        tiltError={tiltError}
        isTouchDevice={isTouchDevice}
        isIOS={isIOS}
        isApkApp={isApkApp}
        isPortrait={isPortrait}
        canLockOrientation={canLockOrientation}
        portraitDismissed={portraitDismissed}
        onRequestLandscape={() => {
          void requestLandscape();
        }}
        onDismissPortrait={dismissPortraitPrompt}
        onSelectTrack={handleSelectTrack}
        onSelectLivery={handleSelectLivery}
        onSelectCar={handleSelectCar}
        onBuyCar={handleBuyCar}
        onSelectDifficulty={handleSelectDifficulty}
        onSelectLaps={handleSelectLaps}
        onSelectSteeringStyle={handleSelectSteeringStyle}
        onSelectSteeringInput={(mode) => {
          void handleSelectSteeringInput(mode);
        }}
        onSelectSensitivity={handleSelectSensitivity}
        onChangeVolume={handleChangeVolume}
        onSelectCamera={handleSelectCamera}
        onToggleMute={handleToggleMute}
        onToggleCollapse={() => setHudCollapsed((p) => !p)}
        onToggleSettings={handleToggleSettings}
        onCloseSettings={() => setSettingsOpen(false)}
        onToggleTrackSelect={handleToggleTrackSelect}
        onCloseTrackSelect={() => setTrackSelectOpen(false)}
        onToggleGarage={handleToggleGarage}
        onCloseGarage={() => setGarageOpen(false)}
        onStartRace={handleStartRace}
        onPauseRace={handlePauseRace}
        onResumeRace={handleResumeRace}
        onRestartRace={handleRestartRace}
        onBackToGrid={handleBackToGrid}
        onRecoverCar={handleRecoverCar}
        onTouchInput={handleTouchInput}
      />
    </div>
  );
}
