import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  LinearProgress,
  TextField,
  Typography,
  keyframes,
} from '@mui/material';
import RadarIcon from '@mui/icons-material/Radar';
import UpgradeIcon from '@mui/icons-material/Upgrade';
import FlightTakeoffIcon from '@mui/icons-material/FlightTakeoff';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { useGame, useGameDispatch } from '@/context/GameContext';
import {
  AbilityType,
  ChallengeState,
  CodeforcesChallengeState,
} from '@/lib/types';

const acceptedPulse = keyframes`
  0% { box-shadow: 0 0 0 rgba(47, 230, 166, 0); }
  35% { box-shadow: 0 0 28px rgba(47, 230, 166, .34); }
  100% { box-shadow: 0 0 0 rgba(47, 230, 166, 0); }
`;

const cardSx = {
  border: '1px solid rgba(139, 164, 190, .16)',
  background: 'rgba(8, 16, 28, .78)',
  borderRadius: '10px',
  p: 1.25,
};

type ResultBanner = {
  source: 'MATH' | 'CODEFORCES';
  tone: 'success' | 'error' | 'info';
  title: string;
  message: string;
  rewardEnergy?: number;
  rewardTroops?: number;
};

type CfStatus =
  | 'AVAILABLE'
  | 'ASSIGNING'
  | 'WAITING FOR SUBMISSION'
  | 'VERIFYING'
  | 'ACCEPTED'
  | 'NOT ACCEPTED'
  | 'EXPIRED'
  | 'ERROR';

interface CommanderPublicConfig {
  maxEnergy: number;
  mathRewards: Record<
    'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT',
    { energy: number; troops: number }
  >;
  codeforcesReward: { energy: number; troops: number };
  abilities: Record<
    'Scout' | 'Reinforce' | 'Airstrike',
    { energy: number; troops?: number }
  >;
}

const abilities = [
  {
    type: AbilityType.Scout,
    icon: <RadarIcon />,
    accent: '#51d9ff',
    effect: 'REVEAL AREA',
  },
  {
    type: AbilityType.Reinforce,
    icon: <UpgradeIcon />,
    accent: '#ffbd59',
    effect: '+40 TROOPS',
  },
  {
    type: AbilityType.Airstrike,
    icon: <FlightTakeoffIcon />,
    accent: '#ff6b7a',
    effect: 'AREA STRIKE',
  },
];

export default function CommanderPanel() {
  const { socketRef, myPlayerId, activeAbility, room } = useGame();
  const { setActiveAbility } = useGameDispatch();
  const currentPlayer = useMemo(
    () => room?.players?.find((player) => player.id === myPlayerId),
    [room, myPlayerId]
  );
  const [energy, setEnergy] = useState(0);
  const [mathChallenge, setMathChallenge] = useState<ChallengeState | null>(
    null
  );
  const [codeforcesChallenge, setCodeforcesChallenge] =
    useState<CodeforcesChallengeState | null>(null);
  const [mathAnswer, setMathAnswer] = useState('');
  const [codeforcesHandle, setCodeforcesHandle] = useState('');
  const [cfStatus, setCfStatus] = useState<CfStatus>('AVAILABLE');
  const [banner, setBanner] = useState<ResultBanner | null>(null);
  const [commanderConfig, setCommanderConfig] =
    useState<CommanderPublicConfig | null>(null);

  const mathCooldown = Boolean(
    currentPlayer &&
      room?.map &&
      currentPlayer.challengeCooldownUntilTurn > room.map.turn
  );

  useEffect(() => {
    if (!currentPlayer) return;
    setEnergy(currentPlayer.energy || 0);
    setMathChallenge(currentPlayer.activeChallenge || null);
    if (currentPlayer.codeforcesHandle)
      setCodeforcesHandle(
        (current) => current || currentPlayer.codeforcesHandle
      );
    const activeCf = currentPlayer.activeCodeforcesChallenge || null;
    setCodeforcesChallenge(activeCf);
    if (activeCf?.rewarded) setCfStatus('ACCEPTED');
    else if (activeCf)
      setCfStatus((current) =>
        current === 'VERIFYING' ? current : 'WAITING FOR SUBMISSION'
      );
  }, [currentPlayer]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const onMathChallenge = (challenge: ChallengeState) => {
      setMathChallenge(challenge);
      setMathAnswer('');
      setBanner(null);
    };
    const onMathResult = (result: any) => {
      if (result.status === 'SOLVED') {
        setEnergy(result.energy);
        setMathChallenge(null);
        setBanner({
          source: 'MATH',
          tone: 'success',
          title: 'SOLVED',
          message: result.message,
          rewardEnergy: result.rewardEnergy,
          rewardTroops: result.rewardTroops,
        });
      } else {
        setMathChallenge(null);
        setBanner({
          source: 'MATH',
          tone: 'error',
          title: result.status === 'EXPIRED' ? 'EXPIRED' : 'NOT SOLVED',
          message: result.message,
        });
      }
    };
    const onCfPending = () => setCfStatus('ASSIGNING');
    const onCfChallenge = (challenge: CodeforcesChallengeState) => {
      setCodeforcesChallenge(challenge);
      setCfStatus('WAITING FOR SUBMISSION');
      setBanner(null);
    };
    const onVerifyPending = () => setCfStatus('VERIFYING');
    const onVerifyResult = (result: any) => {
      if (result.status === 'ACCEPTED') {
        setEnergy(result.energy);
        setCfStatus('ACCEPTED');
        setBanner({
          source: 'CODEFORCES',
          tone: 'success',
          title: 'ACCEPTED',
          message: result.message,
          rewardEnergy: result.rewardEnergy,
          rewardTroops: result.rewardTroops,
        });
      } else if (result.status === 'EXPIRED') {
        setCfStatus('EXPIRED');
        setCodeforcesChallenge(null);
        setBanner({
          source: 'CODEFORCES',
          tone: 'error',
          title: 'EXPIRED',
          message: result.message,
        });
      } else if (result.status === 'ERROR') {
        setCfStatus('ERROR');
        setBanner({
          source: 'CODEFORCES',
          tone: 'error',
          title: 'VERIFICATION ERROR',
          message: result.message,
        });
      } else if (result.status === 'ALREADY_REWARDED') {
        setCfStatus('ACCEPTED');
        setBanner({
          source: 'CODEFORCES',
          tone: 'info',
          title: 'ALREADY REWARDED',
          message: result.message,
        });
      } else {
        setCfStatus('NOT ACCEPTED');
        setBanner({
          source: 'CODEFORCES',
          tone: 'info',
          title: 'NOT ACCEPTED YET',
          message: result.message,
        });
      }
    };
    const onEnergy = ({ energy: nextEnergy }: { energy: number }) =>
      setEnergy(nextEnergy);
    const onConfig = (config: CommanderPublicConfig) =>
      setCommanderConfig(config);
    const onChallengeError = (result: {
      source: 'MATH' | 'CODEFORCES';
      message: string;
    }) => {
      if (result.source === 'CODEFORCES') {
        setCfStatus((current) =>
          current === 'VERIFYING'
            ? 'WAITING FOR SUBMISSION'
            : current === 'ASSIGNING'
              ? 'ERROR'
              : current
        );
      }
      setBanner({
        source: result.source,
        tone: 'error',
        title: 'COMMAND REJECTED',
        message: result.message,
      });
    };
    const onExpired = (result: {
      source: 'MATH' | 'CODEFORCES';
      message: string;
    }) => {
      if (result.source === 'MATH') setMathChallenge(null);
      else {
        setCodeforcesChallenge(null);
        setCfStatus('EXPIRED');
      }
      setBanner({
        source: result.source,
        tone: 'error',
        title: 'EXPIRED',
        message: result.message,
      });
    };
    const onAbilityActivated = ({
      abilityType,
      energy: nextEnergy,
    }: {
      abilityType: AbilityType;
      energy: number;
    }) => {
      setEnergy(nextEnergy);
      setActiveAbility(null);
      setBanner({
        source: 'MATH',
        tone: 'success',
        title: `${abilityType.toUpperCase()} DEPLOYED`,
        message:
          abilityType === AbilityType.Reinforce
            ? '+40 troops delivered.'
            : 'Commander ability confirmed.',
      });
    };
    const onAbilityFailed = (message: string) => {
      setActiveAbility(null);
      setBanner({
        source: 'MATH',
        tone: 'error',
        title: 'ABILITY FAILED',
        message,
      });
    };

    socket.on('math_challenge', onMathChallenge);
    socket.on('math_result', onMathResult);
    socket.on('codeforces_challenge_pending', onCfPending);
    socket.on('codeforces_challenge', onCfChallenge);
    socket.on('codeforces_verification_pending', onVerifyPending);
    socket.on('codeforces_verification_result', onVerifyResult);
    socket.on('energy_update', onEnergy);
    socket.on('commander_config', onConfig);
    socket.on('challenge_error', onChallengeError);
    socket.on('challenge_expired', onExpired);
    socket.on('ability_activated', onAbilityActivated);
    socket.on('ability_failed', onAbilityFailed);
    socket.emit('get_commander_config');
    return () => {
      socket.off('math_challenge', onMathChallenge);
      socket.off('math_result', onMathResult);
      socket.off('codeforces_challenge_pending', onCfPending);
      socket.off('codeforces_challenge', onCfChallenge);
      socket.off('codeforces_verification_pending', onVerifyPending);
      socket.off('codeforces_verification_result', onVerifyResult);
      socket.off('energy_update', onEnergy);
      socket.off('commander_config', onConfig);
      socket.off('challenge_error', onChallengeError);
      socket.off('challenge_expired', onExpired);
      socket.off('ability_activated', onAbilityActivated);
      socket.off('ability_failed', onAbilityFailed);
    };
  }, [socketRef, setActiveAbility]);

  const requestMath = () => socketRef.current?.emit('request_math_challenge');
  const submitMath = (event: FormEvent) => {
    event.preventDefault();
    if (mathChallenge && mathAnswer.trim())
      socketRef.current?.emit(
        'submit_math_answer',
        mathChallenge.id,
        mathAnswer.trim()
      );
  };
  const requestCodeforces = () => {
    setCfStatus('ASSIGNING');
    socketRef.current?.emit('request_codeforces_challenge', {
      handle: codeforcesHandle.trim(),
    });
  };
  const verifyCodeforces = () => {
    if (!codeforcesChallenge) return;
    socketRef.current?.emit('verify_codeforces_solution', {
      contestId: codeforcesChallenge.contestId,
      problemIndex: codeforcesChallenge.problemIndex,
    });
  };
  const openCodeforces = () => {
    if (!codeforcesChallenge) return;
    window.open(
      `https://codeforces.com/problemset/problem/${codeforcesChallenge.contestId}/${codeforcesChallenge.problemIndex}`,
      '_blank',
      'noopener,noreferrer'
    );
  };
  const activateAbility = (type: AbilityType) => {
    setActiveAbility(type);
    setBanner({
      source: 'MATH',
      tone: 'info',
      title: `${type.toUpperCase()} TARGETING`,
      message:
        'Select a valid tile on the battlefield. Press Escape to cancel.',
    });
  };

  const toneColor =
    banner?.tone === 'success'
      ? '#2fe6a6'
      : banner?.tone === 'error'
        ? '#ff6b7a'
        : '#51d9ff';

  return (
    <Box
      sx={{
        color: '#eaf2fa',
        fontFamily: 'Inter, system-ui, sans-serif',
        p: 1.4,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.05,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 0.25,
        }}
      >
        <Box>
          <Typography
            sx={{
              fontSize: 10,
              letterSpacing: 2.4,
              color: '#51d9ff',
              fontWeight: 800,
            }}
          >
            COMMANDER
          </Typography>
          <Typography
            sx={{
              fontSize: 9,
              color: 'rgba(220,235,249,.42)',
              letterSpacing: 1.1,
            }}
          >
            TACTICAL UPLINK // ONLINE
          </Typography>
        </Box>
        <Box
          sx={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            bgcolor: '#2fe6a6',
            boxShadow: '0 0 10px #2fe6a6',
          }}
        />
      </Box>

      <Box sx={{ ...cardSx, background: 'rgba(7, 22, 36, .9)' }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            mb: 0.7,
          }}
        >
          <Typography
            sx={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: 1.55,
              color: 'rgba(231,242,252,.68)',
            }}
          >
            COMMANDER ENERGY
          </Typography>
          <Typography
            sx={{
              fontSize: 18,
              fontWeight: 900,
              color: '#fff',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {energy}
            <Box
              component='span'
              sx={{ fontSize: 10, color: 'rgba(231,242,252,.45)' }}
            >
              {' '}
              / {commanderConfig?.maxEnergy || 100}
            </Box>
          </Typography>
        </Box>
        <LinearProgress
          variant='determinate'
          value={Math.min(
            100,
            (energy / (commanderConfig?.maxEnergy || 100)) * 100
          )}
          sx={{
            height: 7,
            borderRadius: 0,
            bgcolor: 'rgba(255,255,255,.07)',
            '& .MuiLinearProgress-bar': {
              bgcolor: energy >= 80 ? '#ffbd59' : '#38c8f4',
              boxShadow: '0 0 12px rgba(56,200,244,.5)',
              transition: 'transform .65s cubic-bezier(.2,.8,.2,1)',
            },
          }}
        />
      </Box>

      <Typography
        sx={{
          fontSize: 9,
          fontWeight: 800,
          letterSpacing: 1.8,
          color: 'rgba(231,242,252,.48)',
          px: 0.25,
        }}
      >
        COMMANDER CHALLENGES
      </Typography>

      <Box sx={{ ...cardSx, borderLeft: '2px solid #b788ff' }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 0.8,
          }}
        >
          <Typography
            sx={{ fontSize: 11, fontWeight: 900, letterSpacing: 1.2 }}
          >
            🧠 MATH
          </Typography>
          <Chip
            label={mathChallenge?.difficulty || 'TACTICAL'}
            size='small'
            sx={{
              height: 18,
              fontSize: 8,
              fontWeight: 800,
              color: '#d9c2ff',
              bgcolor: 'rgba(183,136,255,.12)',
              borderRadius: 1,
            }}
          />
        </Box>
        {mathChallenge ? (
          <>
            <Typography
              sx={{
                fontSize: 13,
                fontWeight: 700,
                lineHeight: 1.35,
                minHeight: 34,
              }}
            >
              {mathChallenge.question}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1.4, my: 0.8 }}>
              <Typography
                sx={{ fontSize: 10, color: '#65dcff', fontWeight: 800 }}
              >
                +{mathChallenge.rewardEnergy} ENERGY
              </Typography>
              <Typography
                sx={{ fontSize: 10, color: '#ffcb72', fontWeight: 800 }}
              >
                +{mathChallenge.rewardTroops} TROOPS
              </Typography>
            </Box>
            <Box
              component='form'
              onSubmit={submitMath}
              sx={{ display: 'flex', gap: 0.7 }}
            >
              <TextField
                value={mathAnswer}
                onChange={(event) => setMathAnswer(event.target.value)}
                placeholder='ENTER ANSWER'
                size='small'
                fullWidth
                inputProps={{ 'aria-label': 'Math challenge answer' }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    height: 34,
                    color: '#fff',
                    fontSize: 12,
                    bgcolor: 'rgba(0,0,0,.18)',
                    '& fieldset': { borderColor: 'rgba(183,136,255,.25)' },
                  },
                }}
              />
              <Button
                type='submit'
                disabled={!mathAnswer.trim()}
                sx={{
                  minWidth: 72,
                  color: '#f4edff',
                  border: '1px solid rgba(183,136,255,.45)',
                  fontSize: 10,
                  fontWeight: 900,
                }}
              >
                SUBMIT
              </Button>
            </Box>
          </>
        ) : (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
            }}
          >
            <Box>
              <Typography sx={{ fontSize: 11, fontWeight: 700 }}>
                Quick tactical problem
              </Typography>
              <Typography
                sx={{ fontSize: 9, color: 'rgba(231,242,252,.48)', mt: 0.25 }}
              >
                Low risk ·{' '}
                {commanderConfig
                  ? `+${commanderConfig.mathRewards.EASY.energy}–${commanderConfig.mathRewards.EXPERT.energy} energy`
                  : 'reward data syncing'}
              </Typography>
            </Box>
            <Button
              onClick={requestMath}
              disabled={mathCooldown}
              sx={{
                color: '#d9c2ff',
                border: '1px solid rgba(183,136,255,.36)',
                fontSize: 9,
                fontWeight: 900,
                whiteSpace: 'nowrap',
              }}
            >
              {mathCooldown ? 'RECHARGING' : 'SOLVE'}
            </Button>
          </Box>
        )}
      </Box>

      <Box
        sx={{
          ...cardSx,
          borderLeft: '2px solid #2fe6a6',
          animation:
            cfStatus === 'ACCEPTED' ? `${acceptedPulse} 1.2s ease-out` : 'none',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 0.8,
          }}
        >
          <Typography
            sx={{ fontSize: 11, fontWeight: 900, letterSpacing: 1.1 }}
          >
            💻 CODEFORCES
          </Typography>
          <Chip
            label={cfStatus}
            size='small'
            sx={{
              maxWidth: 150,
              height: 18,
              fontSize: 7.5,
              fontWeight: 900,
              color: cfStatus === 'ACCEPTED' ? '#2fe6a6' : '#83e8ff',
              bgcolor: 'rgba(47,230,166,.09)',
              borderRadius: 1,
            }}
          />
        </Box>
        {codeforcesChallenge ? (
          <>
            <Box sx={{ display: 'flex', gap: 0.8, alignItems: 'baseline' }}>
              <Typography sx={{ fontSize: 17, fontWeight: 900, color: '#fff' }}>
                {codeforcesChallenge.contestId}
                {codeforcesChallenge.problemIndex}
              </Typography>
              <Typography sx={{ fontSize: 9, color: 'rgba(231,242,252,.5)' }}>
                RATING {codeforcesChallenge.rating}
              </Typography>
            </Box>
            <Typography
              sx={{ fontSize: 12, fontWeight: 700, lineHeight: 1.3, mt: 0.2 }}
            >
              {codeforcesChallenge.problemName}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1.4, my: 0.8 }}>
              <Typography
                sx={{ fontSize: 12, color: '#2fe6a6', fontWeight: 900 }}
              >
                +{codeforcesChallenge.rewardEnergy} ENERGY
              </Typography>
              <Typography
                sx={{ fontSize: 10, color: '#ffcb72', fontWeight: 800 }}
              >
                +{codeforcesChallenge.rewardTroops} TROOPS
              </Typography>
            </Box>
            <Box
              sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.7 }}
            >
              <Button
                onClick={openCodeforces}
                startIcon={
                  <OpenInNewIcon sx={{ fontSize: '14px !important' }} />
                }
                sx={{
                  color: '#83e8ff',
                  border: '1px solid rgba(81,217,255,.32)',
                  fontSize: 8.5,
                  fontWeight: 900,
                }}
              >
                OPEN
              </Button>
              <Button
                onClick={verifyCodeforces}
                disabled={cfStatus === 'VERIFYING' || cfStatus === 'ACCEPTED'}
                startIcon={
                  cfStatus === 'VERIFYING' ? (
                    <CircularProgress size={12} color='inherit' />
                  ) : (
                    <CheckCircleOutlineIcon
                      sx={{ fontSize: '14px !important' }}
                    />
                  )
                }
                sx={{
                  color: '#5ef0b5',
                  border: '1px solid rgba(47,230,166,.34)',
                  fontSize: 8.5,
                  fontWeight: 900,
                }}
              >
                {cfStatus === 'VERIFYING' ? 'VERIFYING' : 'VERIFY'}
              </Button>
            </Box>
          </>
        ) : (
          <>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                mb: 0.7,
              }}
            >
              <Typography sx={{ fontSize: 10, color: 'rgba(231,242,252,.55)' }}>
                SUPER EASY · beginner A-level
              </Typography>
              <Typography
                sx={{ fontSize: 13, color: '#2fe6a6', fontWeight: 900 }}
              >
                {commanderConfig
                  ? `+${commanderConfig.codeforcesReward.energy} ENERGY`
                  : 'HIGH REWARD'}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 0.7 }}>
              <TextField
                value={codeforcesHandle}
                onChange={(event) => setCodeforcesHandle(event.target.value)}
                placeholder='CODEFORCES HANDLE'
                size='small'
                fullWidth
                inputProps={{
                  'aria-label': 'Codeforces handle',
                  maxLength: 24,
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    height: 34,
                    color: '#fff',
                    fontSize: 11,
                    bgcolor: 'rgba(0,0,0,.18)',
                    '& fieldset': { borderColor: 'rgba(47,230,166,.22)' },
                  },
                }}
              />
              <Button
                onClick={requestCodeforces}
                disabled={
                  cfStatus === 'ASSIGNING' || codeforcesHandle.trim().length < 3
                }
                sx={{
                  minWidth: 76,
                  color: '#5ef0b5',
                  border: '1px solid rgba(47,230,166,.34)',
                  fontSize: 9,
                  fontWeight: 900,
                }}
              >
                {cfStatus === 'ASSIGNING' ? (
                  <CircularProgress size={14} color='inherit' />
                ) : (
                  'ASSIGN'
                )}
              </Button>
            </Box>
          </>
        )}
      </Box>

      {banner && (
        <Box
          role='status'
          sx={{
            borderLeft: `2px solid ${toneColor}`,
            bgcolor: `${toneColor}10`,
            px: 1,
            py: 0.75,
            animation:
              banner.tone === 'success'
                ? `${acceptedPulse} 1.1s ease-out`
                : 'none',
          }}
        >
          <Box
            sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}
          >
            <Typography
              sx={{
                fontSize: 10,
                fontWeight: 900,
                letterSpacing: 1,
                color: toneColor,
              }}
            >
              ✓ {banner.title}
            </Typography>
            {banner.rewardEnergy && (
              <Typography
                sx={{ fontSize: 11, fontWeight: 900, color: toneColor }}
              >
                +{banner.rewardEnergy} ENERGY
              </Typography>
            )}
          </Box>
          <Typography
            sx={{ fontSize: 9, color: 'rgba(231,242,252,.66)', mt: 0.25 }}
          >
            {banner.message}
            {banner.rewardTroops ? ` · +${banner.rewardTroops} troops` : ''}
          </Typography>
        </Box>
      )}

      <Typography
        sx={{
          fontSize: 9,
          fontWeight: 800,
          letterSpacing: 1.8,
          color: 'rgba(231,242,252,.48)',
          px: 0.25,
        }}
      >
        ABILITIES
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 0.7,
        }}
      >
        {abilities.map((ability) => {
          const cost = commanderConfig?.abilities[ability.type]?.energy;
          const affordable = typeof cost === 'number' && energy >= cost;
          const selected = activeAbility === ability.type;
          return (
            <Button
              key={ability.type}
              onClick={() => activateAbility(ability.type)}
              disabled={!affordable}
              aria-pressed={selected}
              sx={{
                minWidth: 0,
                p: 0.75,
                display: 'flex',
                flexDirection: 'column',
                gap: 0.25,
                color: affordable ? ability.accent : 'rgba(231,242,252,.24)',
                border: `1px solid ${selected ? ability.accent : affordable ? `${ability.accent}55` : 'rgba(255,255,255,.06)'}`,
                bgcolor: selected ? `${ability.accent}18` : 'rgba(8,16,28,.72)',
                '& svg': { fontSize: 18 },
              }}
            >
              {ability.icon}
              <Typography
                sx={{ fontSize: 8, fontWeight: 900, letterSpacing: 0.5 }}
              >
                {ability.type.toUpperCase()}
              </Typography>
              <Typography sx={{ fontSize: 9, fontWeight: 900 }}>
                {cost ?? '—'} ENERGY
              </Typography>
              <Typography
                sx={{ fontSize: 6.8, color: 'inherit', opacity: 0.65 }}
              >
                {ability.effect}
              </Typography>
            </Button>
          );
        })}
      </Box>
      {activeAbility && (
        <Button
          onClick={() => setActiveAbility(null)}
          sx={{
            height: 25,
            color: '#ffbd59',
            border: '1px solid rgba(255,189,89,.25)',
            fontSize: 8,
            fontWeight: 900,
          }}
        >
          CANCEL {activeAbility.toUpperCase()} TARGETING
        </Button>
      )}
    </Box>
  );
}
