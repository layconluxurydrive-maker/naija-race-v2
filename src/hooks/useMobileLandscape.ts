import { useCallback, useEffect, useState } from 'react';

type OrientationLockTarget = 'landscape' | 'portrait';

interface OptionalLockScreenOrientation {
  lock?: (orientation: OrientationLockTarget) => Promise<void>;
}

function detectTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(pointer: coarse)').matches ||
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0
  );
}

function detectIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return (
    /iPhone|iPad|iPod/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function detectApkApp(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  return host === 'appassets.androidplatform.net' || /;\s*wv\)/i.test(ua);
}

export function useMobileLandscape() {
  const [isTouchDevice, setIsTouchDevice] = useState<boolean>(detectTouchDevice);
  const [isIOS] = useState<boolean>(detectIOS);
  const [isApkApp] = useState<boolean>(detectApkApp);
  const [isPortrait, setIsPortrait] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerHeight > window.innerWidth : false
  );
  const [portraitDismissed, setPortraitDismissed] = useState<boolean>(false);

  const canLockOrientation =
    !isIOS &&
    typeof screen !== 'undefined' &&
    typeof (screen.orientation as unknown as OptionalLockScreenOrientation | undefined)?.lock ===
      'function';

  useEffect(() => {
    const update = () => {
      setIsTouchDevice(detectTouchDevice());
      const portrait = window.innerHeight > window.innerWidth;
      setIsPortrait(portrait);
      if (!portrait) {
        setPortraitDismissed(false);
      }
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  const requestLandscape = useCallback(async (): Promise<boolean> => {
    if (isIOS) return false;
    try {
      const docEl = document.documentElement as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void>;
      };
      if (!document.fullscreenElement) {
        if (typeof docEl.requestFullscreen === 'function') {
          await docEl.requestFullscreen();
        } else if (typeof docEl.webkitRequestFullscreen === 'function') {
          await docEl.webkitRequestFullscreen();
        }
      }
    } catch {
      // Fullscreen may be rejected in some embedded WebViews; still attempt orientation lock
    }

    try {
      const orientation = screen.orientation as unknown as
        | OptionalLockScreenOrientation
        | undefined;
      if (orientation && typeof orientation.lock === 'function') {
        await orientation.lock('landscape');
        return true;
      }
    } catch {
      // Orientation lock requires fullscreen or installed PWA on Android
    }
    return false;
  }, [isIOS]);

  // Attempt automatic orientation lock on load when running as an installed Android PWA
  useEffect(() => {
    if (!isTouchDevice || isIOS) return;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    if (!isStandalone) return;
    const orientation = screen.orientation as unknown as
      | OptionalLockScreenOrientation
      | undefined;
    orientation?.lock?.('landscape').catch(() => {});
  }, [isTouchDevice, isIOS]);

  return {
    isTouchDevice,
    isIOS,
    isApkApp,
    isPortrait,
    canLockOrientation,
    portraitDismissed,
    dismissPortraitPrompt: () => setPortraitDismissed(true),
    requestLandscape,
  };
}
