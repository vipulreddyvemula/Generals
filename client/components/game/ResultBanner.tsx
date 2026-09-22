import React, { useEffect, useRef } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ResultBannerTone = 'success' | 'error' | 'info' | 'warning';

export interface ResultBannerPayload {
  source: 'MATH' | 'CODEFORCES';
  tone: ResultBannerTone;
  title: string;
  message: string;
  rewardEnergy?: number;
  rewardTroops?: number;
}

// ─── Shared constants (ground truth for tests) ────────────────────────────────

export const TONE_MAP = {
  success: { token: 'var(--g-green)', rgb: '69,217,146' },
  error:   { token: 'var(--g-red)',   rgb: '229,81,85' },
  info:    { token: 'var(--g-blue)',  rgb: '40,104,216' },
  warning: { token: 'var(--g-gold)', rgb: '217,183,101' },
} as const;

export const TONE_ICONS: Record<ResultBannerTone, string> = {
  success: '✓',
  error:   '✗',
  info:    'ℹ',
  warning: '⚠',
};

// Auto-dismiss duration in ms — errors never auto-dismiss
const AUTO_DISMISS_DELAY = 4000;

// ─── Component ────────────────────────────────────────────────────────────────

interface ResultBannerProps {
  banner: ResultBannerPayload;
  onDismiss: () => void;
}

export default function ResultBanner({ banner, onDismiss }: ResultBannerProps) {
  const { tone, title, message, rewardEnergy, rewardTroops } = banner;
  const toneEntry = TONE_MAP[tone] ?? TONE_MAP.info;
  const accent = toneEntry.token;
  const accentRgb = toneEntry.rgb;
  const icon = TONE_ICONS[tone] ?? TONE_ICONS.info;

  const isError = tone === 'error';
  const hasAutoDismiss = !isError;

  // Stable ref so the cleanup in the auto-dismiss effect doesn't close over a
  // stale onDismiss when the parent re-renders.
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  });

  // Auto-dismiss for success / info / warning tones
  useEffect(() => {
    if (isError) return;
    const timer = setTimeout(() => onDismissRef.current(), AUTO_DISMISS_DELAY);
    return () => clearTimeout(timer);
  }, [isError]);

  const showEnergy = typeof rewardEnergy === 'number' && rewardEnergy > 0;
  const showTroops = typeof rewardTroops === 'number' && rewardTroops > 0;

  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      aria-atomic='true'
      style={{
        position: 'relative',
        borderLeft: `4px solid ${accent}`,
        borderRadius: '0 6px 6px 0',
        background: 'var(--g-panel-strong)',
        overflow: 'hidden',
        animation: 'rb-enter 220ms ease-out both',
        fontFamily: 'Roboto, sans-serif',
      }}
    >
      {/* 6% accent tint overlay */}
      <div
        aria-hidden='true'
        style={{
          position: 'absolute',
          inset: 0,
          background: `rgba(${accentRgb}, 0.06)`,
          pointerEvents: 'none',
          ...(tone === 'success'
            ? { animation: 'rb-success-pulse 900ms ease-out forwards' }
            : {}),
        }}
      />

      {/* Content */}
      <div style={{ position: 'relative', padding: '10px 36px 10px 12px' }}>
        {/* Header row: icon + title */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span
            aria-hidden='true'
            style={{
              fontSize: 14,
              color: accent,
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            {icon}
          </span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 900,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: accent,
              lineHeight: 1,
            }}
          >
            {title}
          </span>
        </div>

        {/* Message */}
        <p
          style={{
            margin: '4px 0 0',
            fontSize: 12,
            color: 'var(--g-muted)',
            lineHeight: 1.5,
          }}
        >
          {message}
        </p>

        {/* Reward chips */}
        {(showEnergy || showTroops) && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
              marginTop: 6,
            }}
          >
            {showEnergy && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '2px 6px',
                  borderRadius: 3,
                  border: '1px solid rgba(217,183,101,0.4)',
                  color: 'var(--g-gold)',
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                +{rewardEnergy} ENERGY
              </span>
            )}
            {showTroops && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '2px 6px',
                  borderRadius: 3,
                  border: '1px solid rgba(69,217,146,0.35)',
                  color: 'var(--g-green)',
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                +{rewardTroops} TROOPS
              </span>
            )}
          </div>
        )}
      </div>

      {/* Close button */}
      <button
        type='button'
        aria-label='Dismiss notification'
        onClick={onDismiss}
        style={{
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
          cursor: 'pointer',
          color: 'var(--g-muted)',
          fontSize: 14,
          lineHeight: 1,
          padding: 0,
          borderRadius: 3,
          transition: 'color 0.15s',
        }}
        onMouseEnter={(e) =>
          ((e.currentTarget as HTMLButtonElement).style.color = '#eef4f6')
        }
        onMouseLeave={(e) =>
          ((e.currentTarget as HTMLButtonElement).style.color =
            'var(--g-muted)')
        }
      >
        ✕
      </button>

      {/* Progress bar — shown for auto-dismissing tones */}
      {hasAutoDismiss && (
        <div
          style={{
            height: 3,
            background: 'rgba(255,255,255,0.08)',
            borderRadius: '0 0 6px 0',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              background: 'var(--g-gold)',
              transformOrigin: 'left',
              animation: `rb-progress ${AUTO_DISMISS_DELAY}ms linear forwards`,
            }}
          />
        </div>
      )}
    </div>
  );
}
