import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'dock' | 'settings';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'dock' }) => {
  const { isInstallable, isInstalled, isIOS, isInIframe, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      await install();
      return;
    }
    setShowGuide(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        title="Install NAIJA RUN to your device"
        className={
          variant === 'settings'
            ? 'py-2 px-3.5 rounded-xl bg-sky-600/20 border border-sky-400/35 hover:bg-sky-600/30 text-sky-200 font-medium text-sm transition-colors cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5'
            : 'flex items-center gap-1.5 px-3 py-2 rounded-lg bg-sky-600/20 border border-sky-400/35 hover:bg-sky-600/30 text-sky-200 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0'
        }
      >
        <Download className="w-3.5 h-3.5" />
        <span>Install App</span>
      </button>

      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 pointer-events-auto">
          <div className="w-full max-w-sm rounded-2xl bg-[#0a0c10] border border-white/15 p-5 shadow-2xl text-left">
            <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-sky-400" />
                <h3 className="font-display text-lg font-bold text-white">Install to Phone</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                aria-label="Close install guide"
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isInIframe ? (
              <div className="space-y-2.5 text-xs text-slate-300 leading-relaxed">
                <p>
                  Browser security blocks app installation inside a preview frame. To install directly to your phone:
                </p>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-200">
                  <li>Open the app&apos;s direct URL in Chrome (Android) or Safari (iPhone/iPad).</li>
                  <li>
                    Tap <span className="font-semibold text-white">Install App</span> here, or use your browser menu →{' '}
                    <span className="font-semibold text-white">Add to Home screen</span>.
                  </li>
                </ol>
              </div>
            ) : isIOS ? (
              <div className="space-y-2.5 text-xs text-slate-300 leading-relaxed">
                <p>Install NAIJA RUN on iPhone or iPad using Safari:</p>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-200">
                  <li>
                    Tap the <span className="font-semibold text-white">Share</span> button in Safari&apos;s toolbar.
                  </li>
                  <li>
                    Scroll down and tap <span className="font-semibold text-white">Add to Home Screen</span>.
                  </li>
                  <li>
                    Tap <span className="font-semibold text-white">Add</span> to launch it full-screen from your home screen.
                  </li>
                </ol>
              </div>
            ) : (
              <div className="space-y-2.5 text-xs text-slate-300 leading-relaxed">
                <p>Install NAIJA RUN directly from your browser:</p>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-200">
                  <li>
                    Open your browser menu (<span className="font-semibold text-white">⋮</span> in Chrome/Edge).
                  </li>
                  <li>
                    Tap <span className="font-semibold text-white">Install app</span> or{' '}
                    <span className="font-semibold text-white">Add to Home screen</span>.
                  </li>
                </ol>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="mt-4 w-full py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-colors cursor-pointer"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </>
  );
};
