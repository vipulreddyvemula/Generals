import React, { useState, useEffect, useMemo } from 'react';
import { Box, Typography, Button, TextField, LinearProgress, Paper, IconButton, Tooltip, keyframes } from '@mui/material';
import { useGame, useGameDispatch } from '@/context/GameContext';
import { AbilityType, ChallengeState, MathDomain, UserData } from '@/lib/types';
import BoltIcon from '@mui/icons-material/Bolt';
import SecurityIcon from '@mui/icons-material/Security';
import SpeedIcon from '@mui/icons-material/Speed';
import RadarIcon from '@mui/icons-material/Radar';
import FlightTakeoffIcon from '@mui/icons-material/FlightTakeoff';
import UpgradeIcon from '@mui/icons-material/Upgrade';

// Animations
const pulse = keyframes`
  0% { box-shadow: 0 0 0 0 rgba(0, 212, 255, 0.7); }
  70% { box-shadow: 0 0 0 10px rgba(0, 212, 255, 0); }
  100% { box-shadow: 0 0 0 0 rgba(0, 212, 255, 0); }
`;

const float = keyframes`
  0% { transform: translateY(0px); }
  50% { transform: translateY(-5px); }
  100% { transform: translateY(0px); }
`;

const glow = keyframes`
  0% { filter: drop-shadow(0 0 5px rgba(0, 255, 255, 0.5)); }
  50% { filter: drop-shadow(0 0 15px rgba(0, 255, 255, 0.9)); }
  100% { filter: drop-shadow(0 0 5px rgba(0, 255, 255, 0.5)); }
`;

export default function CommanderPanel() {
  const { room, socketRef, myPlayerId, activeAbility } = useGame();
  const { setActiveAbility } = useGameDispatch();
  
  const currentPlayer = useMemo(() => {
    return room?.players?.find(p => p.id === myPlayerId);
  }, [room, myPlayerId]);

  const [energy, setEnergy] = useState<number>(0);
  const [activeChallenge, setActiveChallenge] = useState<ChallengeState | null>(null);
  const [answerInput, setAnswerInput] = useState<string>('');
  const [feedback, setFeedback] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    if (currentPlayer) {
      if (currentPlayer.energy !== undefined) setEnergy(currentPlayer.energy);
      if (currentPlayer.activeChallenge !== undefined) setActiveChallenge(currentPlayer.activeChallenge);
    }
  }, [currentPlayer]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    socket.on('challenge_issued', (challenge: ChallengeState) => {
      setActiveChallenge(challenge);
      setFeedback(null);
      setAnswerInput('');
    });

    socket.on('challenge_success', (data: { energy: number }) => {
      setEnergy(data.energy);
      setActiveChallenge(null);
      setFeedback({ message: 'Correct! Energy boosted.', type: 'success' });
      setTimeout(() => setFeedback(null), 3000);
    });

    socket.on('challenge_failed', (message: string) => {
      setActiveChallenge(null);
      setFeedback({ message, type: 'error' });
      setTimeout(() => setFeedback(null), 3000);
    });

    socket.on('ability_activated', (data: { abilityType: AbilityType, energy: number }) => {
      setEnergy(data.energy);
      setFeedback({ message: `${data.abilityType} Activated!`, type: 'success' });
      setActiveAbility(null);
      setTimeout(() => setFeedback(null), 3000);
    });

    socket.on('ability_failed', (message: string) => {
      setFeedback({ message, type: 'error' });
      setTimeout(() => setFeedback(null), 3000);
    });

    return () => {
      socket.off('challenge_issued');
      socket.off('challenge_success');
      socket.off('challenge_failed');
      socket.off('ability_activated');
      socket.off('ability_failed');
    };
  }, [socketRef, setActiveAbility]);

  const requestChallenge = () => {
    const domains = [MathDomain.Arithmetic, MathDomain.Algebra, MathDomain.Sequence, MathDomain.Logic];
    const randomDomain = domains[Math.floor(Math.random() * domains.length)];
    socketRef.current.emit('request_challenge', randomDomain);
  };

  const submitChallenge = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeChallenge && answerInput.trim()) {
      socketRef.current.emit('submit_challenge', activeChallenge.id, answerInput.trim());
    }
  };

  const activateAbility = (type: AbilityType, requiresTarget: boolean = false) => {
    if (requiresTarget) {
      setActiveAbility(type);
      setFeedback({ message: `Select a target for ${type}...`, type: 'info' });
    } else {
      socketRef.current.emit('activate_ability', type);
    }
  };

  const abilities = [
    { type: AbilityType.Scout, cost: 20, icon: <RadarIcon />, target: true, color: '#4caf50' },
    { type: AbilityType.Fortify, cost: 25, icon: <SecurityIcon />, target: true, color: '#2196f3' },
    { type: AbilityType.Reinforce, cost: 30, icon: <UpgradeIcon />, target: true, color: '#ff9800' },
    { type: AbilityType.Blitz, cost: 40, icon: <SpeedIcon />, target: false, color: '#f44336' },
    { type: AbilityType.Airstrike, cost: 50, icon: <FlightTakeoffIcon />, target: true, color: '#9c27b0' },
    { type: AbilityType.SupplySurge, cost: 60, icon: <BoltIcon />, target: false, color: '#ffeb3b' },
  ];

  return (
    <Box
      sx={{
        position: 'absolute',
        bottom: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        zIndex: 1000,
        pointerEvents: 'none', // Let clicks pass through empty space
      }}
    >
      {/* Challenge Window */}
      <Box sx={{ display: 'flex', gap: 2, pointerEvents: 'auto' }}>
        {activeChallenge ? (
          <Paper
            elevation={24}
            sx={{
              p: 2,
              background: 'rgba(10, 20, 35, 0.85)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(0, 212, 255, 0.3)',
              borderRadius: 3,
              animation: `${float} 4s ease-in-out infinite`,
              color: 'white',
              minWidth: 300,
            }}
          >
            <Typography variant="caption" sx={{ color: '#00d4ff', textTransform: 'uppercase', letterSpacing: 1 }}>
              {activeChallenge.domain} Challenge
            </Typography>
            <Typography variant="h6" sx={{ my: 1, fontWeight: 'bold' }}>
              {activeChallenge.question}
            </Typography>
            <form onSubmit={submitChallenge} style={{ display: 'flex', gap: '8px' }}>
              <TextField
                variant="outlined"
                size="small"
                autoFocus
                value={answerInput}
                onChange={(e) => setAnswerInput(e.target.value)}
                placeholder="Enter answer..."
                sx={{
                  input: { color: 'white' },
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                    '&:hover fieldset': { borderColor: '#00d4ff' },
                    '&.Mui-focused fieldset': { borderColor: '#00d4ff' },
                  }
                }}
              />
              <Button 
                type="submit" 
                variant="contained"
                sx={{ 
                  background: 'linear-gradient(45deg, #00d4ff, #0055ff)',
                  color: 'white',
                  fontWeight: 'bold',
                  '&:hover': { background: 'linear-gradient(45deg, #0055ff, #00d4ff)' }
                }}
              >
                Submit
              </Button>
            </form>
          </Paper>
        ) : (
          <Button
            variant="contained"
            onClick={requestChallenge}
            startIcon={<BoltIcon />}
            sx={{
              background: 'linear-gradient(45deg, #ff007a, #7a00ff)',
              color: 'white',
              fontWeight: 'bold',
              borderRadius: 8,
              px: 4,
              py: 1.5,
              animation: `${pulse} 2s infinite`,
              boxShadow: '0 4px 15px rgba(255, 0, 122, 0.4)',
              transition: 'transform 0.2s',
              '&:hover': { transform: 'scale(1.05)' }
            }}
          >
            Request Challenge
          </Button>
        )}
      </Box>

      {/* Feedback Message */}
      {feedback && (
        <Typography 
          variant="subtitle1" 
          sx={{ 
            color: feedback.type === 'success' ? '#4caf50' : feedback.type === 'info' ? '#00d4ff' : '#f44336',
            textShadow: '0 0 10px rgba(0,0,0,0.8)',
            fontWeight: 'bold',
            pointerEvents: 'auto'
          }}
        >
          {feedback.message}
        </Typography>
      )}

      {/* Energy Bar & Abilities */}
      <Paper
        elevation={24}
        sx={{
          p: 1.5,
          background: 'rgba(15, 15, 25, 0.9)',
          backdropFilter: 'blur(15px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 4,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 1.5,
          pointerEvents: 'auto',
        }}
      >
        <Box sx={{ width: '100%', display: 'flex', alignItems: 'center', gap: 2 }}>
          <BoltIcon sx={{ color: '#00d4ff', animation: `${glow} 2s infinite` }} />
          <Box sx={{ flexGrow: 1, position: 'relative' }}>
            <LinearProgress 
              variant="determinate" 
              value={energy} 
              sx={{
                height: 12,
                borderRadius: 6,
                backgroundColor: 'rgba(255,255,255,0.1)',
                '& .MuiLinearProgress-bar': {
                  background: 'linear-gradient(90deg, #0055ff, #00d4ff)',
                  boxShadow: '0 0 10px #00d4ff',
                  borderRadius: 6,
                }
              }}
            />
          </Box>
          <Typography sx={{ color: 'white', fontWeight: 'bold', width: 40, textAlign: 'right' }}>
            {energy}%
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 1 }}>
          {abilities.map((ability) => {
            const isAffordable = energy >= ability.cost;
            const isActive = activeAbility === ability.type;
            return (
              <Tooltip key={ability.type} title={`${ability.type} (Cost: ${ability.cost}E)`} placement="top">
                <span>
                  <IconButton
                    disabled={!isAffordable && !isActive}
                    onClick={() => activateAbility(ability.type, ability.target)}
                    sx={{
                      color: isAffordable ? 'white' : 'rgba(255,255,255,0.3)',
                      background: isActive 
                        ? `linear-gradient(135deg, ${ability.color}, #ffffff)`
                        : isAffordable 
                          ? `linear-gradient(135deg, rgba(255,255,255,0.1), ${ability.color}55)` 
                          : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${isAffordable ? ability.color : 'transparent'}`,
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        transform: 'translateY(-3px)',
                        boxShadow: `0 5px 15px ${ability.color}88`,
                        background: `linear-gradient(135deg, ${ability.color}, #ffffff)`
                      }
                    }}
                  >
                    {ability.icon}
                  </IconButton>
                </span>
              </Tooltip>
            );
          })}
        </Box>
      </Paper>
    </Box>
  );
}
