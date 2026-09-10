import React, { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Button, TextField, LinearProgress,
  Paper, IconButton, Tooltip, keyframes, Chip
} from '@mui/material';
import { useGame, useGameDispatch } from '@/context/GameContext';
import { AbilityType, ChallengeState, ABILITY_COSTS } from '@/lib/types';
import BoltIcon from '@mui/icons-material/Bolt';
import SecurityIcon from '@mui/icons-material/Security';
import SpeedIcon from '@mui/icons-material/Speed';
import RadarIcon from '@mui/icons-material/Radar';
import FlightTakeoffIcon from '@mui/icons-material/FlightTakeoff';
import UpgradeIcon from '@mui/icons-material/Upgrade';
import TimerIcon from '@mui/icons-material/Timer';

// ────────────────────────────────────────────────
// Animations
// ────────────────────────────────────────────────
const pulse = keyframes`
  0%   { box-shadow: 0 0 0 0   rgba(0, 212, 255, 0.4); }
  70%  { box-shadow: 0 0 0 6px rgba(0, 212, 255, 0); }
  100% { box-shadow: 0 0 0 0   rgba(0, 212, 255, 0); }
`;

const successFlash = keyframes`
  0%   { background-color: rgba(76, 175, 80, 0);   }
  30%  { background-color: rgba(76, 175, 80, 0.35); }
  100% { background-color: rgba(76, 175, 80, 0);   }
`;

const shake = keyframes`
  0%, 100% { transform: translateX(0); }
  20%       { transform: translateX(-6px); }
  40%       { transform: translateX(6px); }
  60%       { transform: translateX(-4px); }
  80%       { transform: translateX(4px); }
`;

const glow = keyframes`
  0%   { filter: drop-shadow(0 0 2px  rgba(0, 255, 255, 0.3)); }
  50%  { filter: drop-shadow(0 0 8px rgba(0, 255, 255, 0.6)); }
  100% { filter: drop-shadow(0 0 2px  rgba(0, 255, 255, 0.3)); }
`;

// ────────────────────────────────────────────────
// Ability definitions (costs from shared constant)
// ────────────────────────────────────────────────
const ABILITIES = [
  { type: AbilityType.Scout,       icon: <RadarIcon />,         color: '#4caf50', target: true },
  { type: AbilityType.Blitz,       icon: <SpeedIcon />,         color: '#f44336', target: false },
  { type: AbilityType.Fortify,     icon: <SecurityIcon />,      color: '#2196f3', target: true },
  { type: AbilityType.Reinforce,   icon: <UpgradeIcon />,       color: '#ff9800', target: true },
  { type: AbilityType.Airstrike,   icon: <FlightTakeoffIcon />, color: '#9c27b0', target: true },
  { type: AbilityType.SupplySurge, icon: <BoltIcon />,         color: '#ffeb3b', target: false },
];

type FeedbackType = 'success' | 'error' | 'info' | 'warning';

interface Feedback {
  message: string;
  type: FeedbackType;
}

// ────────────────────────────────────────────────
export default function CommanderPanel() {
  const { socketRef, myPlayerId, activeAbility, room } = useGame();
  const { setActiveAbility } = useGameDispatch();

  const currentPlayer = useMemo(
    () => room?.players?.find(p => p.id === myPlayerId),
    [room, myPlayerId]
  );

  const [energy, setEnergy]                     = useState<number>(0);
  const [activeChallenge, setActiveChallenge]   = useState<ChallengeState | null>(null);
  const [answerInput, setAnswerInput]           = useState<string>('');
  const [feedback, setFeedback]                 = useState<Feedback | null>(null);
  const [feedbackAnim, setFeedbackAnim]         = useState<'success' | 'error' | null>(null);

  // Derive cooldown from server state
  const onCooldown = Boolean(
    currentPlayer &&
    room?.map &&
    currentPlayer.challengeCooldownUntilTurn > room.map.turn
  );

  const blitzTurnsRemaining = (currentPlayer?.blitzUntilTurn || 0) > (room?.map?.turn || 0)
    ? currentPlayer!.blitzUntilTurn! - room!.map!.turn
    : 0;
  const isBlitzActive = blitzTurnsRemaining > 0;

  // Sync energy from room state (server-authoritative fallback)
  useEffect(() => {
    if (currentPlayer && currentPlayer.energy !== undefined) {
      setEnergy(currentPlayer.energy);
    }
    // Also sync activeChallenge to handle game restarts and reconnects
    if (currentPlayer) {
      if (!currentPlayer.activeChallenge) {
        setActiveChallenge(null);
      } else if (currentPlayer.activeChallenge && !activeChallenge) {
        setActiveChallenge(currentPlayer.activeChallenge);
      }
    }
  }, [currentPlayer, activeChallenge]);

  // Socket event listeners
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const onChallengeIssued = (challenge: ChallengeState) => {
      setActiveChallenge(challenge);
      setFeedback({ message: '⚡ Challenge received! Answer quickly!', type: 'info' });
      setAnswerInput('');
    };

    const onChallengeSuccess = (data: { energy: number; reward: number }) => {
      setEnergy(data.energy);
      setActiveChallenge(null);
      setFeedback({ message: `✅ Correct! +${data.reward} Energy`, type: 'success' });
      setFeedbackAnim('success');
      setTimeout(() => { setFeedback(null); setFeedbackAnim(null); }, 3500);
    };

    const onChallengeFailed = (message: string) => {
      setActiveChallenge(null);
      setFeedback({ message: `❌ ${message}`, type: 'error' });
      setFeedbackAnim('error');
      setTimeout(() => { setFeedback(null); setFeedbackAnim(null); }, 4000);
    };

    const onAbilityActivated = (data: { abilityType: AbilityType; energy: number }) => {
      setEnergy(data.energy);
      let successMsg = `🎯 ${data.abilityType} activated!`;
      if (data.abilityType === AbilityType.Reinforce) successMsg = `+40 TROOPS`;
      if (data.abilityType === AbilityType.Fortify) successMsg = `DEFENSE BOOST ACTIVE`;
      setFeedback({ message: successMsg, type: 'success' });
      setActiveAbility(null);
      setTimeout(() => setFeedback(null), 3000);
    };

    const onAbilityFailed = (message: string) => {
      setFeedback({ message: `⚠️ ${message}`, type: 'warning' });
      setActiveAbility(null);
      setTimeout(() => setFeedback(null), 3000);
    };

    socket.on('challenge_issued',   onChallengeIssued);
    socket.on('challenge_success',  onChallengeSuccess);
    socket.on('challenge_failed',   onChallengeFailed);
    socket.on('ability_activated',  onAbilityActivated);
    socket.on('ability_failed',     onAbilityFailed);

    return () => {
      socket.off('challenge_issued',   onChallengeIssued);
      socket.off('challenge_success',  onChallengeSuccess);
      socket.off('challenge_failed',   onChallengeFailed);
      socket.off('ability_activated',  onAbilityActivated);
      socket.off('ability_failed',     onAbilityFailed);
    };
  }, [socketRef, setActiveAbility]);

  const requestChallenge = () => {
    if (!socketRef.current) return;
    // No domain argument — server picks randomly (fixes bug: server ignored the arg anyway)
    socketRef.current.emit('request_challenge');
  };

  const submitChallenge = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeChallenge && answerInput.trim() && socketRef.current) {
      socketRef.current.emit('submit_challenge', activeChallenge.id, answerInput.trim());
    }
  };

  const activateAbility = (type: AbilityType, requiresTarget: boolean) => {
    if (!socketRef.current) return;
    if (requiresTarget) {
      setActiveAbility(type);
      setFeedback({ message: `Click a tile to target ${type}`, type: 'info' });
    } else {
      socketRef.current.emit('activate_ability', type);
    }
  };

  const feedbackColor: Record<FeedbackType, string> = {
    success: '#4caf50',
    error:   '#f44336',
    info:    '#00d4ff',
    warning: '#ff9800',
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'transparent',
        padding: 1.5,
        gap: 1.5,
        overflowY: 'auto',
        animation: feedbackAnim === 'success' ? `${successFlash} 0.8s ease` : 'none',
      }}
    >
      {/* ─── HEADER ─── */}
      <Box sx={{ textAlign: 'center', pb: 0.5, borderBottom: '1px solid rgba(0,212,255,0.15)' }}>
        <Typography
          variant="overline"
          sx={{ color: '#00d4ff', letterSpacing: 3, fontSize: '0.65rem', fontWeight: 700 }}
        >
          COMMANDER PANEL
        </Typography>
      </Box>

      {/* ─── ENERGY ─── */}
      <Paper
        elevation={0}
        sx={{
          p: 1.5,
          background: 'rgba(0,212,255,0.04)',
          border: '1px solid rgba(0,212,255,0.15)',
          borderRadius: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.8 }}>
          <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.7rem', letterSpacing: 1.5, textTransform: 'uppercase' }}>
            Energy
          </Typography>
          <Typography sx={{ color: '#00d4ff', fontWeight: 700, fontSize: '0.9rem' }}>
            {energy} / 100
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={Math.min(energy, 100)}
          sx={{
            height: 8,
            borderRadius: 4,
            backgroundColor: 'rgba(255,255,255,0.08)',
            '& .MuiLinearProgress-bar': {
              background: energy >= 80
                ? 'linear-gradient(90deg, #ff007a, #ff9800)'
                : 'linear-gradient(90deg, #0055ff, #00d4ff)',
              boxShadow: '0 0 8px rgba(0, 212, 255, 0.6)',
              borderRadius: 4,
              transition: 'width 0.5s ease',
            }
          }}
        />
      </Paper>

      {/* ─── ACTIVE ABILITY STATUS ─── */}
      {isBlitzActive && (
        <Paper
          elevation={0}
          sx={{
            p: 1.5,
            mt: 1.5,
            background: 'rgba(244, 67, 54, 0.1)',
            border: '1px solid rgba(244, 67, 54, 0.5)',
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            animation: `${pulse} 1.5s infinite`,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SpeedIcon sx={{ color: '#f44336' }} />
            <Typography sx={{ color: '#f44336', fontWeight: 700, letterSpacing: 1 }}>
              BLITZ ACTIVE
            </Typography>
          </Box>
          <Typography sx={{ color: '#fff', fontWeight: 'bold' }}>
            {((blitzTurnsRemaining * 500) / 1000).toFixed(1)}s
          </Typography>
        </Paper>
      )}

      {/* ─── CHALLENGE SECTION ─── */}
      <Box>
        {activeChallenge ? (
          <Paper
            elevation={0}
            sx={{
              p: 1.5,
              background: 'rgba(0, 212, 255, 0.05)',
              border: '1px solid rgba(0, 212, 255, 0.4)',
              borderRadius: 2,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
              <Chip
                label={activeChallenge.domain}
                size="small"
                sx={{
                  background: 'rgba(0,212,255,0.15)',
                  color: '#00d4ff',
                  fontSize: '0.6rem',
                  letterSpacing: 1,
                  height: 18,
                }}
              />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
                <TimerIcon sx={{ fontSize: 13, color: '#ff9800' }} />
                <Typography sx={{ fontSize: '0.65rem', color: '#ff9800' }}>
                  +{activeChallenge.rewardEnergy}E on correct
                </Typography>
              </Box>
            </Box>
            <Typography
              variant="body2"
              sx={{ color: 'white', fontWeight: 600, my: 1, lineHeight: 1.4, fontSize: '0.82rem' }}
            >
              {activeChallenge.question}
            </Typography>
            <form onSubmit={submitChallenge} style={{ display: 'flex', gap: 6 }}>
              <TextField
                variant="outlined"
                size="small"
                autoFocus
                fullWidth
                value={answerInput}
                onChange={e => setAnswerInput(e.target.value)}
                placeholder="Type answer..."
                sx={{
                  '& .MuiInputBase-input': { color: 'white', fontSize: '0.82rem', padding: '6px 10px' },
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                    '&:hover fieldset': { borderColor: '#00d4ff' },
                    '&.Mui-focused fieldset': { borderColor: '#00d4ff' },
                  },
                }}
              />
              <Button
                type="submit"
                variant="contained"
                sx={{
                  background: 'linear-gradient(45deg, #00d4ff, #0055ff)',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  px: 1.5,
                  minWidth: 60,
                  '&:hover': { background: 'linear-gradient(45deg, #0055ff, #00d4ff)' }
                }}
              >
                GO
              </Button>
            </form>
          </Paper>
        ) : (
          <Button
            fullWidth
            variant="contained"
            onClick={requestChallenge}
            disabled={onCooldown}
            startIcon={<BoltIcon />}
            sx={{
              background: onCooldown
                ? 'rgba(100,100,100,0.3)'
                : 'linear-gradient(45deg, #ff007a, #7a00ff)',
              color: onCooldown ? 'rgba(255,255,255,0.4)' : 'white',
              fontWeight: 700,
              borderRadius: 2,
              py: 1.2,
              fontSize: '0.78rem',
              letterSpacing: 1,
              animation: !onCooldown ? `${pulse} 2s infinite` : 'none',
              transition: 'all 0.3s ease',
              '&:hover:not(:disabled)': { transform: 'scale(1.02)' }
            }}
          >
            {onCooldown ? 'RECHARGING...' : 'REQUEST CHALLENGE'}
          </Button>
        )}
      </Box>

      {/* ─── FEEDBACK ─── */}
      {feedback && (
        <Typography
          variant="caption"
          sx={{
            textAlign: 'center',
            color: feedbackColor[feedback.type],
            fontWeight: 600,
            fontSize: '0.72rem',
            animation: feedbackAnim === 'error' ? `${shake} 0.4s ease` : 'none',
            px: 1,
          }}
        >
          {feedback.message}
        </Typography>
      )}

      {/* ─── ABILITIES ─── */}
      <Box>
        <Typography
          sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.65rem', letterSpacing: 1.5, textTransform: 'uppercase', mb: 1 }}
        >
          Abilities
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0.75 }}>
          {ABILITIES.map(ability => {
            const cost         = ABILITY_COSTS[ability.type];
            const isAffordable = energy >= cost;
            const isActive     = activeAbility === ability.type;

            let statusText = isAffordable ? ability.type : `${ability.type} (Need ${cost}E)`;
            if (isActive) {
              if (ability.target) statusText = 'Select friendly territory';
            } else if (isAffordable) {
              if (ability.type === AbilityType.Reinforce) statusText = 'Reinforce +40';
            }

            if (ability.type === AbilityType.Fortify) {
              const myFortifies = room?.map?.activeEffects?.filter((e: any) => e.type === AbilityType.Fortify && e.player?.id === currentPlayer?.id) || [];
              if (myFortifies.length > 0) {
                 const latest = myFortifies.reduce((prev: any, curr: any) => prev.expiresAtTurn > curr.expiresAtTurn ? prev : curr);
                 const turnsLeft = latest.expiresAtTurn - (room?.map?.turn || 0);
                 if (turnsLeft > 0) {
                   statusText = `Fortified ${(turnsLeft * 0.5).toFixed(1)}s`;
                 }
              }
            }

            return (
              <Tooltip key={ability.type} title={statusText} placement="top" arrow>
                <span>
                  <Box
                    onClick={() => isAffordable ? activateAbility(ability.type, ability.target) : undefined}
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 0.3,
                      p: 0.8,
                      borderRadius: 1.5,
                      cursor: isAffordable ? 'pointer' : 'not-allowed',
                      background: isActive
                        ? `linear-gradient(135deg, ${ability.color}55, ${ability.color}33)`
                        : isAffordable
                          ? 'rgba(255,255,255,0.05)'
                          : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${isActive ? ability.color : isAffordable ? ability.color + '55' : 'rgba(255,255,255,0.06)'}`,
                      transition: 'all 0.2s ease',
                      '&:hover': isAffordable ? {
                        background: `${ability.color}22`,
                        border: `1px solid ${ability.color}`,
                        transform: 'translateY(-2px)',
                      } : {},
                    }}
                  >
                    <Box sx={{
                      color: isAffordable ? 'white' : 'rgba(255,255,255,0.25)',
                      '& svg': { fontSize: 18 },
                      ...(isActive && { animation: `${glow} 1.5s infinite` }),
                    }}>
                      {ability.icon}
                    </Box>
                    <Typography sx={{ fontSize: '0.55rem', color: isAffordable ? ability.color : 'rgba(255,255,255,0.2)', letterSpacing: 0.5 }}>
                      {cost}E
                    </Typography>
                  </Box>
                </span>
              </Tooltip>
            );
          })}
        </Box>
      </Box>

      {/* ─── TARGET MODE NOTICE ─── */}
      {activeAbility && (
        <Paper
          elevation={0}
          sx={{
            p: 1,
            background: 'rgba(255,152,0,0.1)',
            border: '1px solid rgba(255,152,0,0.4)',
            borderRadius: 1.5,
            textAlign: 'center',
          }}
        >
          <Typography sx={{ color: '#ff9800', fontSize: '0.7rem', fontWeight: 600 }}>
            🎯 Click a map tile to target {activeAbility}
          </Typography>
          <Button
            size="small"
            onClick={() => { setActiveAbility(null); setFeedback(null); }}
            sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.6rem', mt: 0.3 }}
          >
            Cancel
          </Button>
        </Paper>
      )}
    </Box>
  );
}
