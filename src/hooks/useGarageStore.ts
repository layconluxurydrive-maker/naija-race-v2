import { useCallback, useEffect, useState } from 'react';
import { CAR_COLLECTION, CarSpec } from '../game/types';

const STORAGE_KEY = 'naija_run_garage_v1';

interface GarageSaveState {
  nairaBalance: number;
  unlockedCarIds: string[];
  selectedCarId: string;
  totalNairaEarned: number;
}

const DEFAULT_SAVE: GarageSaveState = {
  nairaBalance: 0,
  unlockedCarIds: [CAR_COLLECTION[0].id],
  selectedCarId: CAR_COLLECTION[0].id,
  totalNairaEarned: 0,
};

function loadSaveState(): GarageSaveState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SAVE;
    const parsed = JSON.parse(raw) as Partial<GarageSaveState>;
    const unlocked = Array.isArray(parsed.unlockedCarIds)
      ? Array.from(new Set([CAR_COLLECTION[0].id, ...parsed.unlockedCarIds]))
      : DEFAULT_SAVE.unlockedCarIds;
    const selectedId =
      typeof parsed.selectedCarId === 'string' &&
      unlocked.includes(parsed.selectedCarId) &&
      CAR_COLLECTION.some((c) => c.id === parsed.selectedCarId)
        ? parsed.selectedCarId
        : CAR_COLLECTION[0].id;
    return {
      nairaBalance:
        typeof parsed.nairaBalance === 'number' && parsed.nairaBalance >= 0
          ? Math.floor(parsed.nairaBalance)
          : 0,
      unlockedCarIds: unlocked,
      selectedCarId: selectedId,
      totalNairaEarned:
        typeof parsed.totalNairaEarned === 'number' && parsed.totalNairaEarned >= 0
          ? Math.floor(parsed.totalNairaEarned)
          : 0,
    };
  } catch {
    return DEFAULT_SAVE;
  }
}

export function useGarageStore() {
  const [state, setState] = useState<GarageSaveState>(loadSaveState);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore quota/private mode storage errors
    }
  }, [state]);

  const addNaira = useCallback((amount: number) => {
    if (amount <= 0) return;
    setState((prev) => ({
      ...prev,
      nairaBalance: prev.nairaBalance + amount,
      totalNairaEarned: prev.totalNairaEarned + amount,
    }));
  }, []);

  const buyCar = useCallback(
    (carId: string): { ok: boolean; car?: CarSpec } => {
      const car = CAR_COLLECTION.find((c) => c.id === carId);
      if (!car) return { ok: false };

      if (state.unlockedCarIds.includes(car.id)) {
        setState((prev) => ({ ...prev, selectedCarId: car.id }));
        return { ok: true, car };
      }

      if (state.nairaBalance < car.priceNaira) {
        return { ok: false, car };
      }

      setState((prev) => {
        if (prev.unlockedCarIds.includes(car.id)) {
          return { ...prev, selectedCarId: car.id };
        }
        if (prev.nairaBalance < car.priceNaira) return prev;
        return {
          ...prev,
          nairaBalance: prev.nairaBalance - car.priceNaira,
          unlockedCarIds: [...prev.unlockedCarIds, car.id],
          selectedCarId: car.id,
        };
      });
      return { ok: true, car };
    },
    [state.nairaBalance, state.unlockedCarIds]
  );

  const selectCar = useCallback(
    (carId: string): CarSpec | null => {
      const car = CAR_COLLECTION.find((c) => c.id === carId);
      if (!car || !state.unlockedCarIds.includes(carId)) return null;
      setState((prev) => {
        if (!prev.unlockedCarIds.includes(carId)) return prev;
        return { ...prev, selectedCarId: carId };
      });
      return car;
    },
    [state.unlockedCarIds]
  );

  const selectedCar =
    CAR_COLLECTION.find((c) => c.id === state.selectedCarId) ?? CAR_COLLECTION[0];

  return {
    nairaBalance: state.nairaBalance,
    unlockedCarIds: state.unlockedCarIds,
    selectedCarId: state.selectedCarId,
    selectedCar,
    totalNairaEarned: state.totalNairaEarned,
    addNaira,
    buyCar,
    selectCar,
  };
}
