import React from 'react';
import { Check, Lock, ShoppingBag, X } from 'lucide-react';
import { CAR_COLLECTION, CarBodyStyle, CarSpec } from '../game/types';

interface GarageModalProps {
  nairaBalance: number;
  unlockedCarIds: string[];
  selectedCarId: string;
  onSelectCar: (car: CarSpec) => void;
  onBuyCar: (car: CarSpec) => void;
  onClose: () => void;
}

const CarProfileSvg: React.FC<{ style: CarBodyStyle; primary: string; accent: string }> = ({
  style,
  primary,
  accent,
}) => {
  const path =
    style === 'street'
      ? 'M12 42 L14 20 L26 11 L78 11 L88 22 L88 42 Z'
      : style === 'coupe'
        ? 'M8 42 L12 28 L34 22 L46 13 L66 13 L84 25 L90 24 L90 42 Z'
        : style === 'drift'
          ? 'M7 42 L13 30 L32 23 L44 14 L64 14 L78 24 L89 24 L89 42 Z'
          : style === 'hyper'
            ? 'M5 42 L15 31 L34 25 L43 15 L60 15 L80 25 L92 26 L92 42 Z'
            : style === 'proto'
              ? 'M5 42 L14 29 L30 27 L41 14 L62 14 L75 24 L91 24 L91 42 Z'
              : 'M9 42 L14 29 L33 23 L45 13 L65 13 L82 24 L90 25 L90 42 Z';

  return (
    <svg viewBox="0 0 100 54" className="w-24 h-13 shrink-0" aria-hidden="true">
      <path d={path} fill={primary} stroke="#ffffff" strokeOpacity="0.2" strokeWidth="1.5" />
      <rect x="24" y="25" width="48" height="3.5" rx="1.5" fill={accent} />
      <circle cx="26" cy="42" r="7.5" fill="#0f172a" stroke="#cbd5e1" strokeWidth="2" />
      <circle cx="74" cy="42" r="7.5" fill="#0f172a" stroke="#cbd5e1" strokeWidth="2" />
    </svg>
  );
};

const StatBar: React.FC<{ label: string; value: number; accentHex: string }> = ({
  label,
  value,
  accentHex,
}) => (
  <div className="flex items-center gap-2 text-[11px]">
    <span className="text-slate-400 w-10 shrink-0">{label}</span>
    <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
      <div
        className="h-full rounded-full"
        style={{ width: `${value}%`, backgroundColor: accentHex }}
      />
    </div>
    <span className="font-telemetry text-slate-300 w-6 text-right tabular-nums">{value}</span>
  </div>
);

export const GarageModal: React.FC<GarageModalProps> = ({
  nairaBalance,
  unlockedCarIds,
  selectedCarId,
  onSelectCar,
  onBuyCar,
  onClose,
}) => {
  const ownedCount = unlockedCarIds.length;

  return (
    <div className="pointer-events-auto bg-[#0a0c10]/96 border border-white/15 rounded-2xl p-4 sm:p-6 w-full max-w-3xl max-h-[calc(100dvh-2rem)] overflow-y-auto shadow-2xl">
      <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-3 mb-4">
        <div>
          <h2 className="font-display text-xl font-bold text-white">Car Collection & Garage</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {ownedCount} of {CAR_COLLECTION.length} cars owned · Collect ₦10 notes on the road to unlock faster rides
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="bg-emerald-950/70 border border-emerald-500/40 rounded-xl px-3 py-1.5 flex items-center gap-2">
            <span className="text-[11px] font-medium text-emerald-300">Wallet</span>
            <span className="font-telemetry text-sm font-bold text-amber-300 tabular-nums">
              ₦{nairaBalance.toLocaleString()}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close garage"
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {CAR_COLLECTION.map((car) => {
          const isOwned = unlockedCarIds.includes(car.id);
          const isEquipped = car.id === selectedCarId;
          const canAfford = nairaBalance >= car.priceNaira;
          const missing = Math.max(0, car.priceNaira - nairaBalance);

          return (
            <div
              key={car.id}
              className={`rounded-xl border p-3.5 flex flex-col justify-between gap-3 transition-colors ${
                isEquipped
                  ? 'bg-white/12 border-emerald-400/60'
                  : isOwned
                    ? 'bg-white/[0.05] border-white/15'
                    : 'bg-white/[0.03] border-white/10'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-display text-base font-bold text-white truncate">
                      {car.name}
                    </h3>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {car.category} · {car.topSpeedKmh} km/h
                    </div>
                  </div>
                  <div className="rounded-lg bg-black/45 border border-white/10 px-2 py-1 shrink-0">
                    <CarProfileSvg
                      style={car.bodyStyle}
                      primary={car.defaultPrimaryHex}
                      accent={car.defaultAccentHex}
                    />
                  </div>
                </div>

                <p className="text-xs text-slate-400 mt-2 leading-snug">{car.description}</p>

                <div className="space-y-1.5 mt-3">
                  <StatBar label="Speed" value={car.statSpeed} accentHex="#f59e0b" />
                  <StatBar label="Accel" value={car.statAccel} accentHex="#10b981" />
                  <StatBar label="Grip" value={car.statHandling} accentHex="#38bdf8" />
                </div>
              </div>

              <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-3">
                <div className="font-telemetry text-xs font-bold tabular-nums">
                  {isOwned ? (
                    <span className="text-emerald-400">Owned</span>
                  ) : (
                    <span className="text-amber-400">₦{car.priceNaira.toLocaleString()}</span>
                  )}
                </div>

                {isEquipped ? (
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold text-xs cursor-pointer whitespace-nowrap"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Equipped</span>
                  </button>
                ) : isOwned ? (
                  <button
                    type="button"
                    onClick={() => onSelectCar(car)}
                    className="px-3.5 py-1.5 rounded-lg bg-white text-slate-950 hover:bg-slate-200 font-semibold text-xs transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Drive This Car
                  </button>
                ) : canAfford ? (
                  <button
                    type="button"
                    onClick={() => onBuyCar(car)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>Buy ₦{car.priceNaira.toLocaleString()}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-slate-400 font-medium text-xs cursor-not-allowed whitespace-nowrap"
                  >
                    <Lock className="w-3 h-3" />
                    <span>Need ₦{missing.toLocaleString()}</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
