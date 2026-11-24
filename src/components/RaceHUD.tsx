import React from 'react';
import {
  Camera,
  CarFront,
  ChevronDown,
  ChevronUp,
  Compass,
  Map as MapIcon,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Settings,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { TRACK_SUMMARIES } from '../game/trackPresets';
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
} from '../game/types';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { GarageModal } from './GarageModal';
import { Minimap } from './Minimap';

interface RaceHUDProps {
  telemetry: RaceTelemetry;
  minimapPath: Array<{ x: number; y: number }>;
  selectedTrackId: TrackId;
  selectedLivery: LiveryOption;
  selectedCar: CarSpec;
  unlockedCarIds: string[];
  nairaBalance: number;
  difficulty: Difficulty;
  laps: number;
  steeringStyle: SteeringStyle;
  steeringInput: SteeringInputMode;
  steeringSensitivity: number;
  volume: number;
  cameraMode: CameraMode;
  muted: boolean;
  hudCollapsed: boolean;
  settingsOpen: boolean;
  trackSelectOpen: boolean;
  garageOpen: boolean;
  tiltError: string | null;
  isTouchDevice: boolean;
  isIOS: boolean;
  isApkApp: boolean;
  isPortrait: boolean;
  canLockOrientation: boolean;
  portraitDismissed: boolean;
  onRequestLandscape: () => void;
  onDismissPortrait: () => void;
  onSelectTrack: (trackId: TrackId) => void;
  onSelectLivery: (livery: LiveryOption) => void;
  onSelectCar: (car: CarSpec) => void;
  onBuyCar: (car: CarSpec) => void;
  onSelectDifficulty: (diff: Difficulty) => void;
  onSelectLaps: (laps: number) => void;
  onSelectSteeringStyle: (style: SteeringStyle) => void;
  onSelectSteeringInput: (mode: SteeringInputMode) => void;
  onSelectSensitivity: (sens: number) => void;
  onChangeVolume: (vol: number) => void;
  onSelectCamera: (mode: CameraMode) => void;
  onToggleMute: () => void;
  onToggleCollapse: () => void;
  onToggleSettings: () => void;
  onCloseSettings: () => void;
  onToggleTrackSelect: () => void;
  onCloseTrackSelect: () => void;
  onToggleGarage: () => void;
  onCloseGarage: () => void;
  onStartRace: () => void;
  onPauseRace: () => void;
  onResumeRace: () => void;
  onRestartRace: () => void;
  onBackToGrid: () => void;
  onRecoverCar: () => void;
  onTouchInput: (patch: Partial<InputState>) => void;
}

function formatMs(ms: number | null): string {
  if (ms === null || ms < 0) return '--:--.--';
  const totalSec = ms / 1000;
  const mins = Math.floor(totalSec / 60);
  const secs = Math.floor(totalSec % 60);
  const hundredths = Math.floor((ms % 1000) / 10);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`;
}

function ordinal(n: number): string {
  if (n === 1) return '1st';
  if (n === 2) return '2nd';
  if (n === 3) return '3rd';
  return `${n}th`;
}

export const RaceHUD: React.FC<RaceHUDProps> = ({
  telemetry,
  minimapPath,
  selectedTrackId,
  selectedLivery,
  selectedCar,
  unlockedCarIds,
  nairaBalance,
  difficulty,
  laps,
  steeringStyle,
  steeringInput,
  steeringSensitivity,
  volume,
  cameraMode,
  muted,
  hudCollapsed,
  settingsOpen,
  trackSelectOpen,
  garageOpen,
  tiltError,
  isTouchDevice,
  isIOS,
  isApkApp,
  isPortrait,
  canLockOrientation,
  portraitDismissed,
  onRequestLandscape,
  onDismissPortrait,
  onSelectTrack,
  onSelectLivery,
  onSelectCar,
  onBuyCar,
  onSelectDifficulty,
  onSelectLaps,
  onSelectSteeringStyle,
  onSelectSteeringInput,
  onSelectSensitivity,
  onChangeVolume,
  onSelectCamera,
  onToggleMute,
  onToggleCollapse,
  onToggleSettings,
  onCloseSettings,
  onToggleTrackSelect,
  onCloseTrackSelect,
  onToggleGarage,
  onCloseGarage,
  onStartRace,
  onPauseRace,
  onResumeRace,
  onRestartRace,
  onBackToGrid,
  onRecoverCar,
  onTouchInput,
}) => {
  const { phase } = telemetry;
  const isOnline = useOnlineStatus();
  const activeTrackSummary =
    TRACK_SUMMARIES.find((t) => t.id === selectedTrackId) ?? TRACK_SUMMARIES[0];
  const anyModalOpen = settingsOpen || trackSelectOpen || garageOpen;
  const showPortraitPrompt =
    isTouchDevice && isPortrait && !portraitDismissed && !anyModalOpen;
  const hideDesktopInputs = isApkApp || isTouchDevice;
  const showTouchPedals =
    phase === 'racing' &&
    !anyModalOpen &&
    (steeringInput === 'onscreen' ||
      steeringInput === 'tilt' ||
      (isTouchDevice && steeringInput !== 'mouse'));
  const showTouchSteerButtons = showTouchPedals && steeringInput !== 'tilt';
  const recentNairaFlash =
    telemetry.lastNairaPickupAt > 0 && performance.now() - telemetry.lastNairaPickupAt < 1400;

  return (
    <div className="pointer-events-none fixed inset-0 z-10 flex flex-col justify-between pt-[max(0.65rem,env(safe-area-inset-top))] pb-[max(0.65rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] sm:p-4 [@media(max-height:480px)]:py-2">
      {!isOnline && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-30 rounded-lg bg-amber-600/95 border border-amber-400/50 px-3 py-1 text-xs font-medium text-white shadow-lg whitespace-nowrap">
          Offline Mode — Running from cached files
        </div>
      )}
      {/* Top Row: Compact Telemetry Strip (Left) + Live Minimap (Right) */}
      <div className="flex items-start justify-between gap-4">
        <div className="pointer-events-auto bg-[#0a0c10]/88 border border-white/10 rounded-xl px-3.5 sm:px-4 py-2.5 sm:py-3 flex items-center gap-4 sm:gap-5 shadow-lg">
          <div>
            <h1 className="font-display text-base sm:text-lg font-bold tracking-wide text-white leading-tight whitespace-nowrap">
              NAIJA RUN
            </h1>
            <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5 whitespace-nowrap">
              <span className="text-slate-200 font-medium">{telemetry.trackName}</span>
              <span aria-hidden="true">·</span>
              <span className="font-telemetry">{telemetry.trackLengthMeters.toLocaleString()}m</span>
              <span aria-hidden="true">·</span>
              <span>{telemetry.totalLaps} {telemetry.totalLaps === 1 ? 'Lap' : 'Laps'}</span>
              <span aria-hidden="true" className="hidden sm:inline">·</span>
              <span className="hidden sm:inline">{difficulty === 'pro' ? 'Pro AI' : 'Casual AI'}</span>
            </div>
          </div>

          <div className="h-8 w-px bg-white/10 hidden sm:block" />

          <div className="flex items-center gap-4 sm:gap-5">
            <div>
              <div className="text-[11px] text-slate-400">Position</div>
              <div className="font-display text-xl font-bold text-amber-400 leading-none mt-0.5 tabular-nums">
                {telemetry.position}
                <span className="text-xs font-medium text-slate-400">/{telemetry.totalRacers}</span>
              </div>
            </div>

            <div>
              <div className="text-[11px] text-slate-400">Lap</div>
              <div className="font-display text-xl font-bold text-white leading-none mt-0.5 tabular-nums">
                {telemetry.lap}
                <span className="text-xs font-medium text-slate-400">/{telemetry.totalLaps}</span>
              </div>
            </div>

            <div>
              <div className="text-[11px] text-slate-400">Naira</div>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="font-telemetry text-base sm:text-lg font-bold text-emerald-400 leading-none tabular-nums">
                  ₦{nairaBalance.toLocaleString()}
                </span>
                {recentNairaFlash && (
                  <span className="font-telemetry text-xs font-bold text-amber-300 leading-none">
                    +₦10
                  </span>
                )}
              </div>
            </div>

            <div className="hidden md:block">
              <div className="text-[11px] text-slate-400">Lap Time</div>
              <div className="font-telemetry text-base font-bold text-white leading-none mt-1">
                {formatMs(telemetry.currentLapTimeMs)}
              </div>
            </div>

            <div className="hidden lg:block">
              <div className="text-[11px] text-slate-400">Best Lap</div>
              <div className="font-telemetry text-base font-bold text-sky-400 leading-none mt-1">
                {formatMs(telemetry.bestLapTimeMs)}
              </div>
            </div>
          </div>
        </div>

        <div className="pointer-events-auto hidden sm:block">
          <Minimap pathPoints={minimapPath} markers={telemetry.minimapMarkers} />
        </div>
      </div>

      {/* Live Rival Finish Notifications (non-blocking, top-center) */}
      {telemetry.notifications.length > 0 && !anyModalOpen && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1.5 pointer-events-none">
          {telemetry.notifications.map((n) => (
            <div
              key={n.id}
              className="bg-[#0a0c10]/92 border border-white/15 rounded-xl px-4 py-2 flex items-center gap-3 shadow-xl text-xs whitespace-nowrap"
            >
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: n.colorHex }}
              />
              <span className="font-semibold text-white">{n.name}</span>
              <span className="text-amber-400 font-semibold">finished {ordinal(n.position)}</span>
              <span aria-hidden="true" className="text-slate-500">·</span>
              <span className="font-telemetry text-slate-300">{formatMs(n.finishTimeMs)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Center Viewport Overlays (Portrait Prompt, Track Select, Countdown, Wrong Way, Pause Menu, Settings Modal, Finish Standings) */}
      <div className="flex flex-col items-center justify-center min-h-0">
        {showPortraitPrompt && (
          <div className="pointer-events-auto bg-[#0a0c10]/96 border border-white/15 rounded-2xl p-5 w-full max-w-xs text-center shadow-2xl">
            <div className="w-11 h-11 rounded-xl bg-red-600/20 border border-red-500/40 text-red-400 flex items-center justify-center mx-auto mb-3">
              <RotateCw className="w-5 h-5" />
            </div>
            <h2 className="font-display text-lg font-bold text-white">Landscape Racing View</h2>
            <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
              {canLockOrientation
                ? 'Switch to landscape for wider track visibility and full touch pedals.'
                : isIOS
                  ? 'Rotate your iPhone or iPad sideways for wider track visibility and comfortable controls.'
                  : 'Rotate your phone sideways for the best racing view and controls.'}
            </p>
            <div className="flex flex-col gap-2 mt-4">
              {canLockOrientation && (
                <button
                  type="button"
                  onClick={onRequestLandscape}
                  className="w-full py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-sm transition-colors cursor-pointer whitespace-nowrap"
                >
                  Switch to Landscape
                </button>
              )}
              <button
                type="button"
                onClick={onDismissPortrait}
                className="w-full py-2 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 font-medium text-xs transition-colors cursor-pointer whitespace-nowrap"
              >
                Continue in Portrait
              </button>
            </div>
          </div>
        )}

        {garageOpen && !settingsOpen && !trackSelectOpen && (
          <GarageModal
            nairaBalance={nairaBalance}
            unlockedCarIds={unlockedCarIds}
            selectedCarId={selectedCar.id}
            onSelectCar={onSelectCar}
            onBuyCar={onBuyCar}
            onClose={onCloseGarage}
          />
        )}

        {trackSelectOpen && !settingsOpen && !garageOpen && (
          <div className="pointer-events-auto bg-[#0a0c10]/96 border border-white/15 rounded-2xl p-5 sm:p-6 w-full max-w-2xl max-h-[calc(100dvh-2rem)] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
              <div>
                <h2 className="font-display text-xl font-bold text-white">Select Circuit</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Choose circuit layout and lap distance from 1,050m sprints to 4,500m endurance tracks
                </p>
              </div>
              <button
                type="button"
                onClick={onCloseTrackSelect}
                aria-label="Close track selection"
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {TRACK_SUMMARIES.map((track) => {
                const isActive = track.id === selectedTrackId;
                const polyPoints = track.previewPoints
                  .map((p) => `${(12 + p.x * 76).toFixed(1)},${(10 + p.y * 56).toFixed(1)}`)
                  .join(' ');

                return (
                  <button
                    key={track.id}
                    type="button"
                    onClick={() => {
                      onSelectTrack(track.id);
                      onCloseTrackSelect();
                    }}
                    className={`text-left rounded-xl border p-3.5 transition-colors cursor-pointer flex items-center gap-3.5 ${
                      isActive
                        ? 'bg-white/12 border-white/50'
                        : 'bg-white/[0.04] border-white/10 hover:bg-white/[0.08] hover:border-white/25'
                    }`}
                  >
                    <div className="w-24 h-20 rounded-lg bg-black/40 border border-white/10 shrink-0 flex items-center justify-center">
                      <svg viewBox="0 0 100 76" className="w-full h-full">
                        <polygon
                          points={polyPoints}
                          fill="none"
                          stroke={isActive ? track.accentHex : '#94a3b8'}
                          strokeWidth="3.5"
                          strokeLinejoin="round"
                        />
                        {track.previewPoints.length > 0 && (
                          <circle
                            cx={12 + track.previewPoints[0].x * 76}
                            cy={10 + track.previewPoints[0].y * 56}
                            r="3"
                            fill="#f59e0b"
                          />
                        )}
                      </svg>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-display text-base font-bold text-white truncate">
                          {track.name}
                        </span>
                        <span
                          className="font-telemetry text-xs font-bold shrink-0"
                          style={{ color: track.accentHex }}
                        >
                          {track.targetLengthMeters.toLocaleString()} m
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-300 mt-0.5">
                        {track.styleTag} · {(track.targetLengthMeters / 1000).toFixed(2)} km
                      </div>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-snug">
                        {track.subtitle}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {settingsOpen && (
          <div className="pointer-events-auto bg-[#0a0c10]/96 border border-white/15 rounded-2xl p-5 sm:p-6 w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
              <h2 className="font-display text-xl font-bold text-white">Race Settings</h2>
              <button
                type="button"
                onClick={onCloseSettings}
                aria-label="Close settings"
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-sm">
              {/* Circuit Map Selector */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-medium">Circuit Map</span>
                  <span className="font-telemetry text-xs text-slate-400">
                    {activeTrackSummary.name} · {activeTrackSummary.targetLengthMeters.toLocaleString()}m
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1 p-1 bg-white/5 rounded-lg">
                  {TRACK_SUMMARIES.map((track) => (
                    <button
                      key={track.id}
                      type="button"
                      onClick={() => onSelectTrack(track.id)}
                      className={`px-2 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                        selectedTrackId === track.id
                          ? 'bg-white text-slate-950'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      {(track.targetLengthMeters / 1000).toFixed(1)}km
                    </button>
                  ))}
                </div>
              </div>

              {/* Car Livery */}
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-300 font-medium">Car Livery</span>
                <div className="flex items-center gap-2">
                  {LIVERY_OPTIONS.map((liv) => {
                    const active = liv.id === selectedLivery.id;
                    return (
                      <button
                        key={liv.id}
                        type="button"
                        onClick={() => onSelectLivery(liv)}
                        title={liv.name}
                        aria-label={liv.name}
                        className={`w-7 h-7 rounded-lg border transition-transform cursor-pointer ${
                          active ? 'border-white scale-110' : 'border-white/20 opacity-80 hover:opacity-100'
                        }`}
                        style={{
                          backgroundColor:
                            liv.id === 'factory' ? selectedCar.defaultPrimaryHex : liv.primaryHex,
                        }}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Race Laps */}
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-300 font-medium">Race Distance</span>
                <div className="flex items-center gap-1 p-1 bg-white/5 rounded-lg">
                  {[1, 3, 5].map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => onSelectLaps(count)}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                        laps === count ? 'bg-white text-slate-950' : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      {count} {count === 1 ? 'Lap' : 'Laps'}
                    </button>
                  ))}
                </div>
              </div>

              {/* AI Difficulty */}
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-300 font-medium">AI Difficulty</span>
                <div className="flex items-center gap-1 p-1 bg-white/5 rounded-lg">
                  {(['casual', 'pro'] as Difficulty[]).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => onSelectDifficulty(d)}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                        difficulty === d ? 'bg-white text-slate-950' : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      {d === 'casual' ? 'Casual' : 'Pro'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Steering Style (Handling Physics) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-300 font-medium">Steering Style</span>
                  <div className="flex items-center gap-1 p-1 bg-white/5 rounded-lg">
                    {(
                      [
                        { id: 'grip', label: 'Grip' },
                        { id: 'arcade', label: 'Arcade' },
                        { id: 'drift', label: 'Drift' },
                      ] as Array<{ id: SteeringStyle; label: string }>
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => onSelectSteeringStyle(opt.id)}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                          steeringStyle === opt.id
                            ? 'bg-white text-slate-950'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 text-right">
                  {steeringStyle === 'grip'
                    ? 'High-traction precision cornering'
                    : steeringStyle === 'drift'
                      ? 'Tail-happy slides with auto-drift entry'
                      : 'Balanced grip and controlled power-slides'}
                </p>
              </div>

              {/* Steering Control Input (hide Keys and Mouse in Android APK / mobile touch devices) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-slate-300 font-medium">Steering Input</span>
                  <div className="flex items-center gap-1 p-1 bg-white/5 rounded-lg">
                    {(hideDesktopInputs
                      ? ([
                          { id: 'onscreen', label: 'Buttons' },
                          { id: 'tilt', label: 'Tilt' },
                        ] as Array<{ id: SteeringInputMode; label: string }>)
                      : ([
                          { id: 'keyboard', label: 'Keys' },
                          { id: 'mouse', label: 'Mouse' },
                          { id: 'onscreen', label: 'Buttons' },
                          { id: 'tilt', label: 'Tilt' },
                        ] as Array<{ id: SteeringInputMode; label: string }>)
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => onSelectSteeringInput(opt.id)}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                          steeringInput === opt.id
                            ? 'bg-white text-slate-950'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                {tiltError && steeringInput === 'tilt' && (
                  <p className="text-[11px] text-amber-400 text-right">{tiltError}</p>
                )}
              </div>

              {/* Steering Sensitivity */}
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-300 font-medium">Steering Response</span>
                <div className="flex items-center gap-1 p-1 bg-white/5 rounded-lg">
                  {[
                    { label: 'Smooth', value: 0.75 },
                    { label: 'Balanced', value: 1.0 },
                    { label: 'Sharp', value: 1.3 },
                  ].map((opt) => (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => onSelectSensitivity(opt.value)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                        Math.abs(steeringSensitivity - opt.value) < 0.05
                          ? 'bg-white text-slate-950'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Camera Mode */}
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-300 font-medium">Camera View</span>
                <div className="flex items-center gap-1 p-1 bg-white/5 rounded-lg">
                  {(['chase', 'hood', 'far'] as CameraMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => onSelectCamera(mode)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap capitalize ${
                        cameraMode === mode ? 'bg-white text-slate-950' : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Audio Volume */}
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-300 font-medium">Audio Volume</span>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={onToggleMute}
                    aria-label={muted ? 'Unmute audio' : 'Mute audio'}
                    className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 cursor-pointer"
                  >
                    {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={muted ? 0 : Math.round(volume * 100)}
                    onChange={(e) => onChangeVolume(Number(e.target.value) / 100)}
                    aria-label="Audio volume"
                    className="w-28 accent-red-500 cursor-pointer"
                  />
                </div>
              </div>

              {/* Controls Legend */}
              <div className="border-t border-white/10 pt-3 text-xs text-slate-400 flex flex-wrap gap-x-4 gap-y-1">
                {hideDesktopInputs ? (
                  <>
                    <span>
                      {steeringInput === 'tilt'
                        ? 'Tilt Phone: Steer Left / Right'
                        : 'Buttons: Tap L / R to Steer'}
                    </span>
                    <span>Gas / Brake / Boost Pedals: Speed</span>
                  </>
                ) : (
                  <>
                    <span>W/A/S/D or Arrows: Drive</span>
                    <span>Shift: Drift</span>
                    <span>Space: Boost</span>
                    <span>C: Camera</span>
                    <span>P: Pause</span>
                    <span>R: Restart</span>
                    <span>F: Reset Car</span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2.5 mt-5 pt-4 border-t border-white/10">
              {phase === 'paused' ? (
                <button
                  type="button"
                  onClick={() => {
                    onCloseSettings();
                    onResumeRace();
                  }}
                  className="flex-1 py-2 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-sm transition-colors cursor-pointer whitespace-nowrap"
                >
                  Resume Race
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onCloseSettings}
                  className="flex-1 py-2 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-sm transition-colors cursor-pointer whitespace-nowrap"
                >
                  Done
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  onCloseSettings();
                  onRestartRace();
                }}
                className="py-2 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white font-medium text-sm transition-colors cursor-pointer whitespace-nowrap"
              >
                Restart
              </button>
            </div>
          </div>
        )}

        {!anyModalOpen && !showPortraitPrompt && phase === 'paused' && (
          <div className="pointer-events-auto bg-[#0a0c10]/95 border border-white/15 rounded-2xl p-5 sm:p-6 w-full max-w-xs max-h-[calc(100dvh-2rem)] overflow-y-auto text-center shadow-2xl">
            <h2 className="font-display text-2xl font-bold text-white">Race Paused</h2>
            <p className="text-xs text-slate-400 mt-1 mb-5">
              Lap {telemetry.lap} of {telemetry.totalLaps} · Position {telemetry.position}/{telemetry.totalRacers}
            </p>
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={onResumeRace}
                className="w-full py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-sm transition-colors cursor-pointer whitespace-nowrap"
              >
                Resume Race
              </button>
              <button
                type="button"
                onClick={onRestartRace}
                className="w-full py-2 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white font-medium text-sm transition-colors cursor-pointer whitespace-nowrap"
              >
                Restart Race
              </button>
              <button
                type="button"
                onClick={onRecoverCar}
                className="w-full py-2 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 font-medium text-sm transition-colors cursor-pointer whitespace-nowrap"
              >
                Reset Car to Track
              </button>
              <button
                type="button"
                onClick={onToggleGarage}
                className="w-full py-2 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-emerald-300 font-medium text-sm transition-colors cursor-pointer whitespace-nowrap"
              >
                Car Collection (₦{nairaBalance.toLocaleString()})
              </button>
              <button
                type="button"
                onClick={onToggleTrackSelect}
                className="w-full py-2 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 font-medium text-sm transition-colors cursor-pointer whitespace-nowrap"
              >
                Change Circuit
              </button>
              <button
                type="button"
                onClick={onToggleSettings}
                className="w-full py-2 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 font-medium text-sm transition-colors cursor-pointer whitespace-nowrap"
              >
                Settings
              </button>
              <button
                type="button"
                onClick={onBackToGrid}
                className="w-full py-2 px-4 rounded-xl text-slate-400 hover:text-white font-medium text-xs transition-colors cursor-pointer whitespace-nowrap"
              >
                Return to Grid
              </button>
            </div>
          </div>
        )}

        {!anyModalOpen && !showPortraitPrompt && phase === 'countdown' && (
          <div className="bg-[#0a0c10]/90 border border-white/15 rounded-2xl px-8 py-4 text-center shadow-2xl">
            <div className="text-xs font-medium text-slate-400 tracking-wider">Starting Grid</div>
            <div className="font-display text-6xl font-bold text-amber-400 tabular-nums mt-1">
              {telemetry.countdownValue > 0 ? telemetry.countdownValue : 'GO'}
            </div>
          </div>
        )}

        {!anyModalOpen && !showPortraitPrompt && phase === 'racing' && telemetry.wrongWay && (
          <div className="bg-red-950/90 border border-red-500/60 rounded-xl px-6 py-2.5 text-center shadow-xl">
            <div className="font-display text-2xl font-bold text-red-400 tracking-wide">
              Wrong Way
            </div>
          </div>
        )}

        {!anyModalOpen && !showPortraitPrompt && phase === 'finished' && (
          <div className="pointer-events-auto bg-[#0a0c10]/95 border border-white/15 rounded-2xl p-5 sm:p-6 w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto shadow-2xl">
            <div className="flex items-baseline justify-between border-b border-white/10 pb-3 mb-4">
              <div>
                <h2
                  className={`font-display text-2xl font-bold ${
                    telemetry.isGameOver ? 'text-red-400' : 'text-white'
                  }`}
                >
                  {telemetry.isGameOver
                    ? 'Game Over'
                    : `${ordinal(telemetry.position)} Place Finish`}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {telemetry.isGameOver
                    ? `${telemetry.standings[0]?.name ?? 'A rival'} won the race · Best Lap ${formatMs(telemetry.bestLapTimeMs)}`
                    : `Victory · Best Lap ${formatMs(telemetry.bestLapTimeMs)}`}
                </p>
              </div>
              <div
                className={`font-display text-3xl font-bold tabular-nums ${
                  telemetry.isGameOver ? 'text-red-400' : 'text-amber-400'
                }`}
              >
                P{telemetry.position}
              </div>
            </div>

            <div className="space-y-2 mb-4">
              {telemetry.standings.map((entry) => (
                <div
                  key={entry.id}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                    entry.isPlayer
                      ? 'bg-white/10 text-white font-semibold'
                      : 'bg-white/[0.03] text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-telemetry text-xs text-slate-400 w-7">
                      {ordinal(entry.position)}
                    </span>
                    <span
                      className="w-2.5 h-2.5 rounded-sm shrink-0"
                      style={{ backgroundColor: entry.colorHex }}
                    />
                    <span>{entry.name}</span>
                  </div>
                  <span className="font-telemetry text-xs text-slate-300">
                    {entry.finished
                      ? formatMs(entry.finishTimeMs)
                      : telemetry.isGameOver && entry.isPlayer
                        ? `Did Not Place (Lap ${entry.lap})`
                        : `Lap ${entry.lap}`}
                  </span>
                </div>
              ))}
            </div>

            <div className="mb-4 rounded-xl bg-emerald-950/55 border border-emerald-500/35 px-3.5 py-2.5 flex items-center justify-between text-xs">
              <span className="text-emerald-200 font-medium">
                {telemetry.notesCollectedCount} road {telemetry.notesCollectedCount === 1 ? 'note' : 'notes'}
                {telemetry.podiumBonusNaira > 0 ? ` + ₦${telemetry.podiumBonusNaira} podium bonus` : ''}
              </span>
              <span className="font-telemetry font-bold text-amber-300 tabular-nums">
                +₦{telemetry.sessionNaira.toLocaleString()}
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onStartRace}
                className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-sm transition-colors cursor-pointer whitespace-nowrap"
              >
                {telemetry.isGameOver ? 'Try Again' : 'Race Again'}
              </button>
              <button
                type="button"
                onClick={onToggleGarage}
                className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-colors cursor-pointer whitespace-nowrap"
              >
                Garage
              </button>
              <button
                type="button"
                onClick={onToggleTrackSelect}
                className="py-2.5 px-3.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-medium text-sm transition-colors cursor-pointer whitespace-nowrap"
              >
                Tracks
              </button>
              <button
                type="button"
                onClick={onBackToGrid}
                className="py-2.5 px-3.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-medium text-sm transition-colors cursor-pointer whitespace-nowrap"
              >
                Grid
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Dock: Collapsible Control & Telemetry Bar */}
      <div className="flex flex-col items-center gap-2">
        {/* Mouse / Tilt Analog Steering Indicator */}
        {phase === 'racing' && !anyModalOpen && !hideDesktopInputs && steeringInput === 'mouse' && (
          <div className="bg-[#0a0c10]/85 border border-white/10 rounded-full px-3 py-1.5 flex items-center gap-3 shadow-lg">
            <span className="text-[11px] text-slate-400 whitespace-nowrap">Mouse Steer</span>
            <div className="relative w-32 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/30" />
              <div
                className="absolute top-0 bottom-0 w-3 -ml-1.5 rounded-full bg-amber-400"
                style={{ left: `${50 - telemetry.steerAxis * 45}%` }}
              />
            </div>
            <span className="text-[11px] text-slate-400 whitespace-nowrap">Click Gas</span>
          </div>
        )}

        {/* Touch / On-Screen Pedals & Tilt Steering during active race */}
        {showTouchPedals && (
          <div className="pointer-events-auto w-full flex justify-between items-end pb-1 touch-none select-none">
            {showTouchSteerButtons ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onPointerDown={() => onTouchInput({ left: true })}
                  onPointerUp={() => onTouchInput({ left: false })}
                  onPointerCancel={() => onTouchInput({ left: false })}
                  onPointerLeave={() => onTouchInput({ left: false })}
                  className="w-14 h-12 sm:w-16 sm:h-14 rounded-xl bg-[#0a0c10]/85 border border-white/15 text-white font-bold text-lg active:bg-white/20 touch-none select-none"
                >
                  L
                </button>
                <button
                  type="button"
                  onPointerDown={() => onTouchInput({ right: true })}
                  onPointerUp={() => onTouchInput({ right: false })}
                  onPointerCancel={() => onTouchInput({ right: false })}
                  onPointerLeave={() => onTouchInput({ right: false })}
                  className="w-14 h-12 sm:w-16 sm:h-14 rounded-xl bg-[#0a0c10]/85 border border-white/15 text-white font-bold text-lg active:bg-white/20 touch-none select-none"
                >
                  R
                </button>
              </div>
            ) : (
              <div className="bg-[#0a0c10]/85 border border-white/15 rounded-xl px-3 py-2 flex items-center gap-2.5 shadow-lg">
                <span className="text-[11px] font-medium text-slate-300 whitespace-nowrap">
                  Tilt Steer
                </span>
                <div className="relative w-24 h-2 bg-white/10 rounded-full overflow-hidden">
                  <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/35" />
                  <div
                    className="absolute top-0 bottom-0 w-3 -ml-1.5 rounded-full bg-emerald-400"
                    style={{ left: `${50 - telemetry.steerAxis * 45}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onPointerDown={() => onTouchInput({ boost: true, throttle: true })}
                onPointerUp={() => onTouchInput({ boost: false, throttle: false })}
                onPointerCancel={() => onTouchInput({ boost: false, throttle: false })}
                onPointerLeave={() => onTouchInput({ boost: false, throttle: false })}
                className="px-4 h-12 sm:h-14 rounded-xl bg-sky-600/90 border border-sky-400/40 text-white font-semibold text-xs touch-none select-none"
              >
                Boost
              </button>
              <button
                type="button"
                onPointerDown={() => onTouchInput({ brake: true })}
                onPointerUp={() => onTouchInput({ brake: false })}
                onPointerCancel={() => onTouchInput({ brake: false })}
                onPointerLeave={() => onTouchInput({ brake: false })}
                className="px-4 h-12 sm:h-14 rounded-xl bg-[#0a0c10]/85 border border-white/15 text-slate-200 font-semibold text-xs touch-none select-none"
              >
                Brake
              </button>
              <button
                type="button"
                onPointerDown={() => onTouchInput({ throttle: true })}
                onPointerUp={() => onTouchInput({ throttle: false })}
                onPointerCancel={() => onTouchInput({ throttle: false })}
                onPointerLeave={() => onTouchInput({ throttle: false })}
                className="px-5 h-12 sm:h-14 rounded-xl bg-red-600/90 border border-red-400/40 text-white font-semibold text-xs touch-none select-none"
              >
                Gas
              </button>
            </div>
          </div>
        )}

        {/* Collapse / Expand Toggle Handle */}
        <button
          type="button"
          onClick={onToggleCollapse}
          className="pointer-events-auto flex items-center gap-1.5 px-3 py-1 rounded-t-lg bg-[#0a0c10]/85 border border-b-0 border-white/10 text-[11px] font-medium text-slate-300 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
          aria-expanded={!hudCollapsed}
        >
          {hudCollapsed ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              <span>Show Controls</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              <span>Hide Controls</span>
            </>
          )}
        </button>

        {/* Main Collapsible Bottom Dock */}
        {!hudCollapsed && (
          <div className="pointer-events-auto bg-[#0a0c10]/90 border border-white/10 rounded-2xl px-4 py-3 shadow-2xl max-w-[96vw] w-fit">
            {phase === 'ready' ? (
              <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-5">
                {/* Livery Swatches */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-400 whitespace-nowrap">
                    Paint
                  </span>
                  <div className="flex items-center gap-1.5">
                    {LIVERY_OPTIONS.map((liv) => {
                      const active = liv.id === selectedLivery.id;
                      return (
                        <button
                          key={liv.id}
                          type="button"
                          onClick={() => onSelectLivery(liv)}
                          title={liv.name}
                          aria-label={liv.name}
                          className={`w-7 h-7 rounded-lg border transition-transform cursor-pointer ${
                            active
                              ? 'border-white scale-110'
                              : 'border-white/20 opacity-80 hover:opacity-100'
                          }`}
                          style={{
                            backgroundColor:
                              liv.id === 'factory' ? selectedCar.defaultPrimaryHex : liv.primaryHex,
                          }}
                        />
                      );
                    })}
                  </div>
                </div>

                <div className="h-6 w-px bg-white/10 hidden sm:block" />

                {/* Difficulty Segmented Control */}
                <div className="flex items-center gap-1 p-1 bg-white/5 rounded-lg">
                  {(['casual', 'pro'] as Difficulty[]).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => onSelectDifficulty(d)}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                        difficulty === d
                          ? 'bg-white text-slate-950'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      {d === 'casual' ? 'Casual' : 'Pro'}
                    </button>
                  ))}
                </div>

                {/* Camera Mode Quick Switcher */}
                <div className="hidden md:flex items-center gap-1 p-1 bg-white/5 rounded-lg">
                  <Camera className="w-3.5 h-3.5 text-slate-400 ml-1.5 mr-1" />
                  {(['chase', 'hood', 'far'] as CameraMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => onSelectCamera(mode)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap capitalize ${
                        cameraMode === mode
                          ? 'bg-white text-slate-950'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>

                {/* Track Map Selector, Car Collection Garage, Settings, Sound, Start */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onToggleGarage}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      garageOpen
                        ? 'bg-emerald-500 text-slate-950 font-semibold'
                        : 'bg-emerald-950/70 border border-emerald-500/40 hover:bg-emerald-900/70 text-emerald-200'
                    }`}
                  >
                    <CarFront className="w-4 h-4" />
                    <span>{selectedCar.name}</span>
                  </button>

                  <button
                    type="button"
                    onClick={onToggleTrackSelect}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      trackSelectOpen
                        ? 'bg-white text-slate-950'
                        : 'bg-white/5 hover:bg-white/10 text-slate-200'
                    }`}
                  >
                    <MapIcon className="w-4 h-4" />
                    <span>
                      {activeTrackSummary.name} · {activeTrackSummary.targetLengthMeters.toLocaleString()}m
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={onToggleMute}
                    aria-label={muted ? 'Unmute audio' : 'Mute audio'}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    <span className="hidden sm:inline">{muted ? 'Muted' : 'Sound'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={onToggleSettings}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      settingsOpen
                        ? 'bg-white text-slate-950'
                        : 'bg-white/5 hover:bg-white/10 text-slate-200'
                    }`}
                  >
                    <Settings className="w-4 h-4" />
                    <span>Settings</span>
                  </button>

                  <button
                    type="button"
                    onClick={onStartRace}
                    className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-sm transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Start</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-5">
                {/* Speed & Gear Readout */}
                <div className="flex items-baseline gap-2.5">
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-display text-3xl font-bold text-white tabular-nums leading-none">
                      {telemetry.speedKmh}
                    </span>
                    <span className="text-[11px] font-medium text-slate-400">km/h</span>
                  </div>
                  <div className="px-2 py-0.5 rounded bg-white/10 font-telemetry text-xs font-bold text-amber-400">
                    {telemetry.gear}
                  </div>
                </div>

                {/* Nitro Boost Bar */}
                <div className="flex flex-col gap-1 w-28 sm:w-32">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className={telemetry.isBoosting ? 'text-sky-400 font-semibold' : 'text-slate-400'}>
                      {telemetry.isBoosting ? 'Boost' : telemetry.isDrifting ? 'Charging' : 'Nitro'}
                    </span>
                    <span className="font-telemetry text-slate-300">{telemetry.nitro}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-75 ${
                        telemetry.isBoosting ? 'bg-sky-400' : 'bg-amber-400'
                      }`}
                      style={{ width: `${telemetry.nitro}%` }}
                    />
                  </div>
                </div>

                <div className="h-6 w-px bg-white/10 hidden md:block" />

                {/* Camera Mode Switcher */}
                <div className="flex items-center gap-1 p-1 bg-white/5 rounded-lg">
                  <Camera className="w-3.5 h-3.5 text-slate-400 ml-1.5 mr-1 hidden sm:block" />
                  {(['chase', 'hood', 'far'] as CameraMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => onSelectCamera(mode)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap capitalize ${
                        cameraMode === mode
                          ? 'bg-white text-slate-950'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>

                {/* Primary Race Action Buttons: Start/Pause/Resume, Restart, Reset Car, Sound, Settings */}
                <div className="flex items-center gap-1.5">
                  {phase === 'paused' ? (
                    <button
                      type="button"
                      onClick={onResumeRace}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Resume</span>
                    </button>
                  ) : phase === 'finished' ? (
                    <button
                      type="button"
                      onClick={onStartRace}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Start</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={onPauseRace}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Pause className="w-3.5 h-3.5" />
                      <span>Pause</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={onRestartRace}
                    title="Restart race (R)"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restart</span>
                  </button>

                  {(phase === 'racing' || phase === 'paused') && (
                    <button
                      type="button"
                      onClick={onRecoverCar}
                      title="Reset car to track center (F)"
                      className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Compass className="w-3.5 h-3.5" />
                      <span>Reset Car</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={onToggleMute}
                    aria-label={muted ? 'Unmute audio' : 'Mute audio'}
                    title={muted ? 'Unmute audio' : 'Mute audio'}
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-200 transition-colors cursor-pointer shrink-0"
                  >
                    {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>

                  <button
                    type="button"
                    onClick={onToggleSettings}
                    aria-label="Open settings"
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      settingsOpen
                        ? 'bg-white text-slate-950'
                        : 'bg-white/5 hover:bg-white/10 text-slate-200'
                    }`}
                  >
                    <Settings className="w-4 h-4" />
                    <span className="hidden sm:inline">Settings</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
