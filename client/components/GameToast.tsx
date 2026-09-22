import { useState, useEffect, useRef } from 'react';
import { useGame, useGameDispatch } from '@/context/GameContext';

// ---------------------------------------------------------------------------
// Tone map — accent CSS token + RGB values for alpha overlays
// ---------------------------------------------------------------------------
export const TONE_MAP = {
  success: { token: 'var(--g-green)', rgb: '69,217,146' },
  error: { token: 'var(--g-red)', rgb: '229,81,85' },
  info: { token: 'var(--g-blue)', rgb: '40,104,216' },
  warning: { token: 'var(--g-gold)', rgb: '217,183,101' },
} as const;

export const TONE_ICONS: Record<string, string> = {
  success: '✓',
  error: '✗',
  info: 'ℹ',
  warning: '⚠',
};

type ToneKey = keyof typeof TONE_MAP;

function resolveTone(status: string | undefined): ToneKey {
  if (status && status in TONE_MAP) return status as ToneKey;
  return 'info';
}

// ---------------------------------------------------------------------------
// GameToast
// ---------------------------------------------------------------------------
export default function GameToast() {
  const { snackState } = useGame();
  const { snackStateDispatch } = useGameDispatch();

  // `rendered` controls whether the component is in the DOM.
  // `exiting` drives the slide-out CSS animation before unmount.
  const [rendered, setRendered] = useState(snackState.open);
  const [exiting, setExiting] = useState(false);
  // `progressKey` is incremented on each update to restart the progress bar CSS animation.
  const [progressKey, setProgressKey] = useState(0);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (snackState.open) {
      setExiting(false);
      setRendered(true);
    } else if (rendered) {
      setExiting(true);
      const t = setTimeout(() => setRendered(false), 220);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snackState.open]);

  // Auto-dismiss timer — restarts whenever open state, duration, title, or message changes.
  useEffect(() => {
    // Increment key to restart the progress bar animation.
    setProgressKey(k => k + 1);

    // Clear any pending timer from the previous render cycle.
    if (dismissTimerRef.current !== null) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }

    if (!snackState.open || !snackState.duration || snackState.duration <= 0) return;

    dismissTimerRef.current = setTimeout(() => {
      snackStateDispatch({ type: 'close' });
    }, snackState.duration);

    return () => {
      if (dismissTimerRef.current !== null) {
        clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snackState.open, snackState.duration, snackState.title, snackState.message]);

  if (!rendered) return null;

  const tone = resolveTone(snackState.status);
  const accent = TONE_MAP[tone].token;
  const icon = TONE_ICONS[tone];

  const handleDismiss = () => {
    snackStateDispatch({ type: 'close' });
  };

  // -------------------------------------------------------------------------
  // Styles
  // -------------------------------------------------------------------------
  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: 24,
    right: 24,
    zIndex: 1400,
    minWidth: 280,
    maxWidth: 380,
    borderRadius: '0 8px 8px 0',
    border: '1px solid var(--g-border)',
    borderLeft: `4px solid ${accent}`,
    background: 'var(--g-panel-strong)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
    overflow: 'hidden',
    fontFamily: 'Roboto, sans-serif',
    animation: exiting
      ? 'gt-exit 220ms ease-in forwards'
      : 'gt-enter 280ms cubic-bezier(0.22,1,0.36,1) forwards',
  };

  const innerStyle: React.CSSProperties = {
    padding: '12px 36px 12px 14px',
    position: 'relative',
  };

  const headerRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  };

  const iconStyle: React.CSSProperties = {
    fontSize: 16,
    color: accent,
    flexShrink: 0,
    lineHeight: 1,
  };

  const titleStyle: React.CSSProperties = {
    fontWeight: 700,
    fontSize: 13,
    color: accent,
    lineHeight: 1.3,
  };

  const messageStyle: React.CSSProperties = {
    fontSize: 12,
    color: 'var(--g-muted)',
    lineHeight: 1.5,
    marginTop: 4,
    marginLeft: 24, // align with title (icon width + gap)
  };

  const closeBtnStyle: React.CSSProperties = {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    border: 'none',
    color: 'var(--g-muted)',
    cursor: 'pointer',
    fontSize: 14,
    padding: 0,
    borderRadius: 3,
  };

  const progressTrackStyle: React.CSSProperties = {
    height: 3,
    background: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  };

  const progressFillStyle: React.CSSProperties = {
    height: '100%',
    background: accent,
    transformOrigin: 'left',
    animation: `gt-progress ${snackState.duration}ms linear forwards`,
  };

  const showProgressBar = snackState.open && snackState.duration !== null && snackState.duration > 0;

  return (
    <div
      role={snackState.status === 'error' ? 'alert' : 'status'}
      aria-live={snackState.status === 'error' ? 'assertive' : 'polite'}
      aria-atomic="true"
      style={containerStyle}
    >
      <div style={innerStyle}>
        {/* Close button */}
        <button
          type="button"
          aria-label="Dismiss notification"
          onClick={handleDismiss}
          style={closeBtnStyle}
        >
          ✕
        </button>

        {/* Header: icon + title */}
        <div style={headerRowStyle}>
          <span aria-hidden="true" style={iconStyle}>
            {icon}
          </span>
          <span style={titleStyle}>{snackState.title}</span>
        </div>

        {/* Message */}
        {snackState.message && (
          <p style={messageStyle}>{snackState.message}</p>
        )}
      </div>

      {/* Progress bar — depletes over snackState.duration ms; key restarts animation on update */}
      {showProgressBar && (
        <div style={progressTrackStyle}>
          <div key={progressKey} style={progressFillStyle} />
        </div>
      )}
    </div>
  );
}
