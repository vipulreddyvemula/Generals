import React, { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  LinearProgress,
  TextField,
  Typography,
  keyframes,
  Tabs,
  Tab,
} from '@mui/material';
import RadarIcon from '@mui/icons-material/Radar';
import UpgradeIcon from '@mui/icons-material/Upgrade';
import FlightTakeoffIcon from '@mui/icons-material/FlightTakeoff';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ExtensionOutlinedIcon from '@mui/icons-material/ExtensionOutlined';
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined';
import PsychologyAltOutlinedIcon from '@mui/icons-material/PsychologyAltOutlined';
import CodeOutlinedIcon from '@mui/icons-material/CodeOutlined';
import SkipNextOutlinedIcon from '@mui/icons-material/SkipNextOutlined';
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

const sectionCardSx = {
  border: '1px solid var(--g-border)',
  borderRadius: '7px',
  background: 'var(--g-panel)',
  boxShadow: '0 14px 40px rgba(0,0,0,0.2)',
  p: 1.7,
} as const;

// Shared sx patterns for MUI Buttons — overrides globals.css border-radius/transform
const blueBtnSx = {
  width: '100%',
  height: 40,
  borderRadius: '5px !important',
  background: '#1c3d6e',
  border: '1px solid #2d5a9e',
  color: '#d6e6ff',
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: '0.05em',
  textTransform: 'none' as const,
  boxShadow: '0 4px 14px rgba(10,25,60,0.45)',
  '&:hover:not(:disabled)': {
    background: '#254d8a',
    borderColor: '#3a6db8',
    boxShadow: '0 6px 20px rgba(10,25,60,0.6)',
    transform: 'translateY(-1px)',
  },
  '&:disabled': {
    background: 'rgba(28,61,110,0.4)',
    borderColor: 'rgba(45,90,158,0.35)',
    color: 'rgba(214,230,255,0.4)',
    boxShadow: 'none',
    cursor: 'not-allowed',
  },
  transition: 'all 0.18s',
};

const outlineBtnSx = {
  width: '100%',
  height: 38,
  borderRadius: '5px !important',
  background: 'rgba(8,21,33,0.7)',
  border: '1px solid var(--g-gold)',
  color: '#f2ead7',
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '0.04em',
  textTransform: 'none' as const,
  '&:hover': {
    background: 'rgba(190,150,69,0.12)',
    transform: 'translateY(-1px)',
  },
  transition: 'all 0.18s',
};

const ghostBtnSx = {
  width: '100%',
  height: 36,
  borderRadius: '5px !important',
  background: 'transparent',
  border: '1px solid var(--g-border)',
  color: 'var(--g-muted)',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'none' as const,
  '&:hover': {
    background: 'rgba(104,148,171,0.08)',
    color: '#eef4f6',
  },
  transition: 'all 0.18s',
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
  | 'PREPARING QUEUE'
  | 'WAITING FOR SUBMISSION'
  | 'VERIFYING'
  | 'SKIPPING'
  | 'ACCEPTED'
  | 'NOT ACCEPTED'
  | 'EXPIRED'
  | 'ERROR';

interface CodeforcesQueueStatus {
  readyPlayers: number;
  totalPlayers: number;
  readyPlayerIds: string[];
  initialized: boolean;
}

interface CommanderPublicConfig {
  maxEnergy: number;
  mathRewards: Record<
    'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT',
    { energy: number; troops: number }
  >;
  codeforcesReward: {
    energy: number;
    troops: number;
    difficulty: CodeforcesChallengeState['difficulty'];
    clistBand: number;
  };
  codeforcesSkipCosts: number[];
  abilities: Record<
    'Scout' | 'Reinforce' | 'Airstrike',
    { energy: number; troops?: number }
  >;
}

const abilities = [
  {
    type: AbilityType.Scout,
    icon: <RadarIcon />,
    accent: '#2fe6a6',
    effect: 'Reveals a 5×5 area on the map',
  },
  {
    type: AbilityType.Airstrike,
    icon: <FlightTakeoffIcon />,
    accent: '#e55155',
    effect: 'Halves troops on an enemy tile',
  },
  {
    type: AbilityType.Reinforce,
    icon: <UpgradeIcon />,
    accent: '#2868d8',
    effect: 'Spawns troops on a friendly tile',
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
  const [cfStatus, setCfStatus] = useState<CfStatus>('AVAILABLE');
  const [cfQueueStatus, setCfQueueStatus] =
    useState<CodeforcesQueueStatus | null>(null);
  const [cfQueueExhausted, setCfQueueExhausted] = useState(false);
  const acceptedTransitionRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const [banner, setBanner] = useState<ResultBanner | null>(null);
  const [commanderConfig, setCommanderConfig] =
    useState<CommanderPublicConfig | null>(null);
  const [activeTab, setActiveTab] = useState<'CHALLENGES' | 'ABILITIES'>(
    'CHALLENGES'
  );
  const [collapsed, setCollapsed] = useState(false);
  const [connected, setConnected] = useState(
    Boolean(socketRef.current?.connected)
  );
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    setConnected(socket.connected);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, [socketRef]);

  useEffect(() => {
    // Walk up to the g-game-right aside and override its grid column width
    const aside = panelRef.current?.parentElement;
    if (!aside) return;
    if (collapsed) {
      aside.style.width = '0px';
      aside.style.minWidth = '0px';
      aside.style.overflow = 'visible';
      aside.style.padding = '0px';
      aside.style.gap = '0px';
    } else {
      aside.style.width = '';
      aside.style.minWidth = '';
      aside.style.overflow = '';
      aside.style.padding = '';
      aside.style.gap = '';
    }
  }, [collapsed]);

  useEffect(() => {
    const openForTutorial = () => setCollapsed(false);
    window.addEventListener('tutorial-open-commander', openForTutorial);
    return () =>
      window.removeEventListener('tutorial-open-commander', openForTutorial);
  }, []);

  const mathCooldown = Boolean(
    currentPlayer &&
      room?.map &&
      currentPlayer.challengeCooldownUntilTurn > room.map.turn
  );

  useEffect(() => {
    if (!currentPlayer) return;
    setEnergy(currentPlayer.energy || 0);
    setMathChallenge(currentPlayer.activeChallenge || null);
    const activeCf = currentPlayer.activeCodeforcesChallenge || null;
    // A room update can arrive while the accepted banner is visible. Keep the
    // completed card on screen until its queued successor is revealed.
    if (!acceptedTransitionRef.current) setCodeforcesChallenge(activeCf);
    if (activeCf?.rewarded) setCfStatus('ACCEPTED');
    else if (activeCf && !acceptedTransitionRef.current)
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
        if (result.status !== 'ERROR') setMathChallenge(null);
        setBanner({
          source: 'MATH',
          tone: 'error',
          title:
            result.status === 'EXPIRED'
              ? 'EXPIRED'
              : result.status === 'ERROR'
                ? 'TRY AGAIN'
                : 'NOT SOLVED',
          message: result.message,
        });
      }
    };
    const onCfPending = () => setCfStatus('ASSIGNING');
    const onCfHistoryReady = () => setCfStatus('PREPARING QUEUE');
    const onCfQueueStatus = (status: CodeforcesQueueStatus) => {
      setCfQueueStatus(status);
      if (!status.initialized && status.readyPlayerIds.includes(myPlayerId)) {
        setCfStatus('PREPARING QUEUE');
      }
    };
    const onCfChallenge = (challenge: CodeforcesChallengeState) => {
      if (acceptedTransitionRef.current) {
        clearTimeout(acceptedTransitionRef.current);
        acceptedTransitionRef.current = null;
      }
      setCodeforcesChallenge(challenge);
      setCfStatus('WAITING FOR SUBMISSION');
      setCfQueueExhausted(false);
      setBanner(null);
    };
    const onVerifyPending = () => setCfStatus('VERIFYING');
    const onCfSkipped = (result: {
      challenge: CodeforcesChallengeState;
      energy: number;
      cost: number;
      skipCount: number;
      nextSkipCost: number;
      message: string;
    }) => {
      setEnergy(result.energy);
      setCodeforcesChallenge(result.challenge);
      setCfStatus('WAITING FOR SUBMISSION');
      setCfQueueExhausted(false);
      setBanner({
        source: 'CODEFORCES',
        tone: 'info',
        title: 'OVERRIDE COMPLETE',
        message: `${result.message} Next override costs ${result.nextSkipCost} energy.`,
      });
    };
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
        if (acceptedTransitionRef.current)
          clearTimeout(acceptedTransitionRef.current);
        acceptedTransitionRef.current = setTimeout(() => {
          acceptedTransitionRef.current = null;
          if (result.nextChallenge) {
            setCodeforcesChallenge(result.nextChallenge);
            setCfStatus('WAITING FOR SUBMISSION');
            setCfQueueExhausted(false);
          } else {
            setCodeforcesChallenge(null);
            setCfStatus('ERROR');
            setCfQueueExhausted(true);
          }
        }, 1400);
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
          title: 'NOT SOLVED YET',
          message: result.message,
        });
      }
    };
    const onCfQueueExhausted = ({ message }: { message: string }) => {
      setCodeforcesChallenge(null);
      setCfQueueExhausted(true);
      setCfStatus('ERROR');
      setBanner({
        source: 'CODEFORCES',
        tone: 'info',
        title: 'NO MORE PROBLEMS',
        message,
      });
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
            : current === 'SKIPPING'
              ? 'WAITING FOR SUBMISSION'
              : current === 'ASSIGNING'
                ? 'ERROR'
                : current
        );
      }
      setBanner({
        source: result.source,
        tone: 'error',
        title: 'ACTION FAILED',
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
    socket.on('codeforces_history_ready', onCfHistoryReady);
    socket.on('codeforces_queue_status', onCfQueueStatus);
    socket.on('codeforces_challenge', onCfChallenge);
    socket.on('codeforces_queue_exhausted', onCfQueueExhausted);
    socket.on('codeforces_verification_pending', onVerifyPending);
    socket.on('codeforces_verification_result', onVerifyResult);
    socket.on('codeforces_challenge_skipped', onCfSkipped);
    socket.on('energy_update', onEnergy);
    socket.on('commander_config', onConfig);
    socket.on('challenge_error', onChallengeError);
    socket.on('challenge_expired', onExpired);
    socket.on('ability_activated', onAbilityActivated);
    socket.on('ability_failed', onAbilityFailed);
    socket.emit('get_commander_config');
    socket.emit('get_codeforces_queue_status');
    return () => {
      socket.off('math_challenge', onMathChallenge);
      socket.off('math_result', onMathResult);
      socket.off('codeforces_challenge_pending', onCfPending);
      socket.off('codeforces_history_ready', onCfHistoryReady);
      socket.off('codeforces_queue_status', onCfQueueStatus);
      socket.off('codeforces_challenge', onCfChallenge);
      socket.off('codeforces_queue_exhausted', onCfQueueExhausted);
      socket.off('codeforces_verification_pending', onVerifyPending);
      socket.off('codeforces_verification_result', onVerifyResult);
      socket.off('codeforces_challenge_skipped', onCfSkipped);
      socket.off('energy_update', onEnergy);
      socket.off('commander_config', onConfig);
      socket.off('challenge_error', onChallengeError);
      socket.off('challenge_expired', onExpired);
      socket.off('ability_activated', onAbilityActivated);
      socket.off('ability_failed', onAbilityFailed);
      if (acceptedTransitionRef.current)
        clearTimeout(acceptedTransitionRef.current);
    };
  }, [socketRef, setActiveAbility, myPlayerId]);

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
    setCfQueueExhausted(false);
    socketRef.current?.emit('request_codeforces_challenge');
  };
  const verifyCodeforces = () => {
    if (
      !codeforcesChallenge ||
      cfStatus === 'VERIFYING' ||
      cfStatus === 'SKIPPING' ||
      cfStatus === 'ACCEPTED'
    )
      return;
    setCfStatus('VERIFYING');
    socketRef.current?.emit('verify_codeforces_solution', {
      contestId: codeforcesChallenge.contestId,
      problemIndex: codeforcesChallenge.problemIndex,
      queuePosition: codeforcesChallenge.queuePosition,
    });
  };
  const skipCodeforces = () => {
    if (
      !codeforcesChallenge ||
      cfStatus === 'VERIFYING' ||
      cfStatus === 'SKIPPING' ||
      cfStatus === 'ACCEPTED'
    )
      return;
    setCfStatus('SKIPPING');
    socketRef.current?.emit('skip_codeforces_challenge', {
      assignmentId: codeforcesChallenge.id,
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
      ? 'var(--g-green)'
      : banner?.tone === 'error'
        ? 'var(--g-red)'
        : '#51d9ff';

  const bannerBg =
    banner?.tone === 'success'
      ? 'rgba(69,217,146,.07)'
      : banner?.tone === 'error'
        ? 'rgba(229,81,85,.07)'
        : 'rgba(81,217,255,.07)';

  const cfPlayerReady = Boolean(
    cfQueueStatus?.readyPlayerIds.includes(myPlayerId)
  );
  const completedCodeforcesSkips = currentPlayer?.codeforcesSkipCount || 0;
  const configuredSkipCosts = commanderConfig?.codeforcesSkipCosts || [
    10, 20, 30,
  ];
  const nextCodeforcesSkipCost =
    configuredSkipCosts[
      Math.min(completedCodeforcesSkips, configuredSkipCosts.length - 1)
    ] || 30;
  const canAffordCodeforcesSkip = energy >= nextCodeforcesSkipCost;

  return (
    <>
      {/* Panel toggle — attached to left edge, hidden on mobile */}
      <Box
        component='button'
        onClick={() => setCollapsed((c) => !c)}
        aria-label={
          collapsed ? 'Open commander panel' : 'Close commander panel'
        }
        sx={{
          position: 'absolute',
          left: -20,
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 50,
          display: { xs: 'none', md: 'flex' },
          alignItems: 'center',
          justifyContent: 'center',
          width: 20,
          height: 52,
          background: 'rgba(7,19,29,0.97)',
          border: '1px solid rgba(217,183,101,0.5)',
          borderRight: 'none',
          borderRadius: '6px 0 0 6px',
          cursor: 'pointer',
          color: 'rgba(217,183,101,0.8)',
          fontSize: 14,
          lineHeight: 1,
          transition: 'color 0.15s, background 0.15s',
          boxShadow: '-3px 0 10px rgba(0,0,0,0.5)',
          '@media (max-width: 760px)': {
            display: 'none',
          },
          '&:hover': {
            color: 'var(--g-gold)',
            background: 'rgba(217,183,101,0.1)',
          },
        }}
      >
        {collapsed ? '‹' : '›'}
      </Box>
      <Box
        ref={panelRef}
        className='g-commander'
        sx={{
          color: '#eaf2fa',
          fontFamily: 'Roboto, sans-serif',
          p: collapsed ? 0 : 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 1.3,
          height: '100%',
          minHeight: 0,
          overflowY: collapsed ? 'hidden' : 'auto',
          overflowX: 'hidden',
          transition: 'padding 0.2s',
        }}
      >
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 0.5,
            py: 0.5,
            borderBottom: collapsed
              ? 'none'
              : '1px solid rgba(217,183,101,0.18)',
            mb: collapsed ? 0 : 0.5,
          }}
        >
          {/* Left: title only */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box>
              <Typography
                sx={{
                  fontFamily: '"Cinzel", serif',
                  fontSize: 22,
                  fontWeight: 900,
                  letterSpacing: '0.12em',
                  color: 'var(--g-gold)',
                  lineHeight: 1,
                  textShadow: '0 2px 16px rgba(217,183,101,0.3)',
                }}
              >
                COMMANDER
              </Typography>
              <Typography
                sx={{
                  fontSize: 8,
                  color: 'rgba(217,183,101,0.55)',
                  letterSpacing: '0.22em',
                  lineHeight: 1,
                  mt: 0.35,
                  textTransform: 'uppercase',
                }}
              >
                TACTICAL UPLINK
              </Typography>
            </Box>
          </Box>

          {/* Right: status badge only */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              px: 0.8,
              py: 0.3,
              borderRadius: '4px',
              background: connected
                ? 'rgba(69,217,146,0.1)'
                : 'rgba(229,81,85,0.1)',
              border: `1px solid ${connected ? 'rgba(69,217,146,0.3)' : 'rgba(229,81,85,0.3)'}`,
            }}
          >
            <Box
              sx={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: connected ? 'var(--g-green)' : 'var(--g-red)',
                boxShadow: `0 0 6px ${connected ? 'var(--g-green)' : 'var(--g-red)'}`,
                flexShrink: 0,
              }}
            />
            <Typography
              sx={{
                fontSize: 8,
                fontWeight: 700,
                letterSpacing: '0.1em',
                color: connected ? 'var(--g-green)' : 'var(--g-red)',
                lineHeight: 1,
              }}
            >
              {connected ? 'ONLINE' : 'OFFLINE'}
            </Typography>
          </Box>
        </Box>

        {!collapsed && (
          <>
            {/* Energy Bar */}
            <Box sx={{ ...sectionCardSx }}>
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
                    font: '700 13px Cinzel, serif',
                    color: 'var(--g-gold)',
                    letterSpacing: '0.07em',
                    textTransform: 'uppercase',
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
                    sx={{ fontSize: 10, color: 'var(--g-muted)' }}
                  >
                    {' '}
                    /{' '}
                    {room?.isSandbox ? 1000 : commanderConfig?.maxEnergy || 100}
                  </Box>
                </Typography>
              </Box>
              <LinearProgress
                variant='determinate'
                value={Math.min(
                  100,
                  (energy /
                    (room?.isSandbox
                      ? 1000
                      : commanderConfig?.maxEnergy || 100)) *
                    100
                )}
                sx={{
                  height: 11,
                  borderRadius: 6,
                  bgcolor: 'rgba(255,255,255,.07)',
                  '& .MuiLinearProgress-bar': {
                    bgcolor: 'var(--g-blue)',
                    boxShadow: '0 0 12px rgba(40,104,216,.5)',
                    transition: 'transform .65s cubic-bezier(.2,.8,.2,1)',
                  },
                }}
              />
            </Box>

            {/* Tabs */}
            <Tabs
              value={activeTab}
              onChange={(_, newValue) => {
                setActiveTab(newValue);
                if (room?.isSandbox && newValue === 'ABILITIES') {
                  window.dispatchEvent(
                    new CustomEvent('tutorial-abilities-opened')
                  );
                }
              }}
              variant='fullWidth'
              sx={{
                minHeight: 42,
                borderBottom: '1px solid var(--g-border)',
                '& .MuiTab-root': {
                  minHeight: 42,
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  color: 'var(--g-muted)',
                  p: 0,
                  paddingX: 1,
                  borderBottom: '3px solid transparent',
                  borderRadius: 0,
                  background: 'transparent',
                  transition: 'color 0.18s, border-color 0.18s',
                },
                '& .Mui-selected': {
                  color: '#ffffff !important',
                  borderBottom: '3px solid var(--g-gold) !important',
                  background: 'transparent',
                },
                '& .MuiTabs-indicator': {
                  display: 'none',
                },
              }}
            >
              <Tab
                icon={<ExtensionOutlinedIcon sx={{ fontSize: 17 }} />}
                iconPosition='start'
                label='CHALLENGES'
                value='CHALLENGES'
              />
              <Tab
                data-tutorial='abilities-tab'
                icon={<GavelOutlinedIcon sx={{ fontSize: 17 }} />}
                iconPosition='start'
                label='ABILITIES'
                value='ABILITIES'
              />
            </Tabs>

            {/* Challenges Tab */}
            {activeTab === 'CHALLENGES' && (
              <>
                {/* Math Challenge Card */}
                <Box data-tutorial='math-card' sx={{ ...sectionCardSx }}>
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      mb: 0.8,
                    }}
                  >
                    <Typography
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.7,
                        font: '700 13px Cinzel, serif',
                        color: 'var(--g-gold)',
                        letterSpacing: '0.07em',
                        textTransform: 'uppercase',
                      }}
                    >
                      <PsychologyAltOutlinedIcon
                        sx={{ fontSize: 19, color: 'rgba(217,183,101,0.7)' }}
                      />
                      MATH CHALLENGE
                    </Typography>
                  </Box>
                  {mathChallenge ? (
                    <>
                      <Typography
                        component='div'
                        sx={{
                          fontSize: 15,
                          fontWeight: 700,
                          lineHeight: 1.35,
                          minHeight: 34,
                          mt: 1.5,
                          color: '#eef4f6',
                          '& p': { m: 0 },
                          '& .katex': { color: '#eef4f6' },
                        }}
                      >
                        <ReactMarkdown
                          remarkPlugins={[remarkMath]}
                          rehypePlugins={[rehypeKatex]}
                        >
                          {mathChallenge.question}
                        </ReactMarkdown>
                      </Typography>
                      <Box
                        component='form'
                        onSubmit={submitMath}
                        sx={{ display: 'grid', gap: 1.2, mt: 1.5 }}
                      >
                        <TextField
                          value={mathAnswer}
                          onChange={(event) =>
                            setMathAnswer(event.target.value)
                          }
                          placeholder='Enter your answer...'
                          size='small'
                          fullWidth
                          inputProps={{ 'aria-label': 'Math challenge answer' }}
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              height: 43,
                              color: '#fff',
                              fontSize: 12,
                              bgcolor: 'rgba(0,0,0,.18)',
                              '& fieldset': {
                                borderColor: 'rgba(104,148,171,.45)',
                              },
                            },
                          }}
                        />
                        <Button
                          className='tutorial-math-submit-btn'
                          type='submit'
                          disabled={!mathAnswer.trim()}
                          disableRipple
                          disableElevation
                          sx={blueBtnSx}
                        >
                          Verify Answer
                        </Button>
                      </Box>
                    </>
                  ) : (
                    <Box sx={{ display: 'grid', gap: 1.2, mt: 1.3 }}>
                      <Typography
                        sx={{ fontSize: 12, color: 'var(--g-muted)' }}
                      >
                        Request a tactical question to solve in-game.
                      </Typography>
                      <Button
                        data-tutorial='math-request'
                        className='tutorial-math-btn'
                        onClick={requestMath}
                        disabled={mathCooldown}
                        disableRipple
                        disableElevation
                        sx={blueBtnSx}
                      >
                        {mathCooldown ? 'Recharging' : 'Get Math Challenge'}
                      </Button>
                    </Box>
                  )}
                </Box>

                {/* Codeforces Challenge Card */}
                <Box
                  sx={{
                    ...sectionCardSx,
                    animation:
                      cfStatus === 'ACCEPTED'
                        ? `${acceptedPulse} 1.2s ease-out`
                        : 'none',
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
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.7,
                        font: '700 13px Cinzel, serif',
                        color: 'var(--g-gold)',
                        letterSpacing: '0.07em',
                        textTransform: 'uppercase',
                      }}
                    >
                      <CodeOutlinedIcon
                        sx={{ fontSize: 19, color: 'rgba(217,183,101,0.7)' }}
                      />
                      CODEFORCES CHALLENGE
                    </Typography>
                    <Chip
                      label={cfStatus}
                      size='small'
                      sx={{
                        maxWidth: 150,
                        height: 18,
                        fontSize: 8,
                        fontWeight: 900,
                        color:
                          cfStatus === 'ACCEPTED'
                            ? 'var(--g-green)'
                            : 'rgba(231,242,252,0.6)',
                        bgcolor:
                          cfStatus === 'ACCEPTED'
                            ? 'rgba(69,217,146,0.12)'
                            : 'rgba(104,148,171,0.12)',
                        borderRadius: 1,
                      }}
                    />
                  </Box>
                  {codeforcesChallenge ? (
                    <>
                      <Box
                        sx={{
                          display: 'flex',
                          gap: 0.8,
                          alignItems: 'baseline',
                          mt: 1.5,
                        }}
                      >
                        <Typography
                          sx={{ fontSize: 17, fontWeight: 900, color: '#fff' }}
                        >
                          {codeforcesChallenge.contestId}
                          {codeforcesChallenge.problemIndex}
                        </Typography>
                      </Box>
                      <Typography
                        sx={{
                          fontSize: 15,
                          fontWeight: 700,
                          lineHeight: 1.3,
                          mt: 0.3,
                        }}
                      >
                        {codeforcesChallenge.problemName}
                      </Typography>
                      <Typography
                        sx={{
                          fontSize: 12,
                          color: 'var(--g-muted)',
                          mt: 1.5,
                          lineHeight: 1.5,
                        }}
                      >
                        Solve on Codeforces using your handle.
                        <br />
                        Get Accepted, then verify.
                      </Typography>
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: '1fr',
                          gap: 1,
                          mt: 1.5,
                        }}
                      >
                        <Button
                          onClick={openCodeforces}
                          startIcon={
                            <OpenInNewIcon
                              sx={{ fontSize: '14px !important' }}
                            />
                          }
                          disableRipple
                          disableElevation
                          sx={outlineBtnSx}
                        >
                          Open in Codeforces
                        </Button>
                        <Button
                          onClick={verifyCodeforces}
                          disabled={
                            cfStatus === 'VERIFYING' ||
                            cfStatus === 'SKIPPING' ||
                            cfStatus === 'ACCEPTED'
                          }
                          startIcon={
                            cfStatus === 'VERIFYING' ? (
                              <CircularProgress size={12} color='inherit' />
                            ) : (
                              <CheckCircleOutlineIcon
                                sx={{ fontSize: '14px !important' }}
                              />
                            )
                          }
                          disableRipple
                          disableElevation
                          sx={blueBtnSx}
                        >
                          {cfStatus === 'VERIFYING'
                            ? 'Checking…'
                            : cfStatus === 'ACCEPTED'
                              ? 'Accepted'
                              : 'Verify Solution'}
                        </Button>
                        <Button
                          onClick={skipCodeforces}
                          disabled={
                            cfStatus === 'VERIFYING' ||
                            cfStatus === 'SKIPPING' ||
                            cfStatus === 'ACCEPTED' ||
                            !canAffordCodeforcesSkip
                          }
                          title={
                            canAffordCodeforcesSkip
                              ? `Replace this challenge for ${nextCodeforcesSkipCost} energy`
                              : `Need ${nextCodeforcesSkipCost} energy to override`
                          }
                          startIcon={
                            cfStatus === 'SKIPPING' ? (
                              <CircularProgress size={12} color='inherit' />
                            ) : (
                              <SkipNextOutlinedIcon
                                sx={{ fontSize: '15px !important' }}
                              />
                            )
                          }
                          disableRipple
                          disableElevation
                          sx={{
                            ...ghostBtnSx,
                            borderColor: 'rgba(217,183,101,0.42)',
                            color: 'rgba(242,234,215,0.82)',
                          }}
                        >
                          {cfStatus === 'SKIPPING'
                            ? 'Overriding…'
                            : `Override · ${nextCodeforcesSkipCost} energy`}
                        </Button>
                        <Typography
                          sx={{
                            mt: -0.4,
                            textAlign: 'center',
                            fontSize: 9,
                            color: 'rgba(231,242,252,0.45)',
                            letterSpacing: 0.25,
                          }}
                        >
                          Skip costs: 10 first · 20 second · 30 thereafter
                        </Typography>
                      </Box>
                    </>
                  ) : (
                    <>
                      <Typography
                        sx={{ fontSize: 12, color: 'var(--g-muted)', mb: 1 }}
                      >
                        Your Codeforces handle was checked before the match.
                        Request your assigned challenge when ready.
                      </Typography>
                      {cfQueueStatus && !cfQueueStatus.initialized && (
                        <Typography
                          sx={{
                            fontSize: 9,
                            color: cfPlayerReady ? '#5ef0b5' : '#83e8ff',
                            mb: 0.7,
                            letterSpacing: 0.4,
                          }}
                        >
                          Preparing shared queue · {cfQueueStatus.readyPlayers}/
                          {cfQueueStatus.totalPlayers} players ready
                        </Typography>
                      )}
                      {cfQueueExhausted ? (
                        <Typography
                          sx={{
                            fontSize: 10,
                            color: 'rgba(231,242,252,.62)',
                            border: '1px solid rgba(47,230,166,.16)',
                            px: 1,
                            py: 0.8,
                          }}
                        >
                          No more eligible shared problems remain in this band.
                        </Typography>
                      ) : (
                        <Button
                          onClick={requestCodeforces}
                          disabled={cfStatus === 'ASSIGNING'}
                          disableRipple
                          disableElevation
                          sx={blueBtnSx}
                        >
                          {cfStatus === 'ASSIGNING' ? (
                            <CircularProgress size={14} color='inherit' />
                          ) : (
                            'Get Codeforces Challenge'
                          )}
                        </Button>
                      )}
                    </>
                  )}
                </Box>
              </>
            )}

            {/* Result Banner */}
            {banner && (
              <Box
                role='status'
                sx={{
                  borderLeft: `3px solid ${toneColor}`,
                  background: bannerBg,
                  borderRadius: '0 5px 5px 0',
                  px: 1.5,
                  py: 1,
                  animation:
                    banner.tone === 'success'
                      ? `${acceptedPulse} 1.1s ease-out`
                      : 'none',
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 1,
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: 11,
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
                  sx={{ fontSize: 12, color: 'var(--g-muted)', mt: 0.25 }}
                >
                  {banner.message}
                  {banner.rewardTroops
                    ? ` · +${banner.rewardTroops} troops`
                    : ''}
                </Typography>
              </Box>
            )}

            {/* Abilities Tab */}
            {activeTab === 'ABILITIES' && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {abilities.map((ability) => {
                  const cost = commanderConfig?.abilities[ability.type]?.energy;
                  const affordable = typeof cost === 'number' && energy >= cost;
                  const selected = activeAbility === ability.type;
                  return (
                    <Box
                      key={ability.type}
                      data-tutorial={`${ability.type.toLowerCase()}-ability`}
                      component='button'
                      className={`tutorial-ability-${ability.type.toLowerCase()}`}
                      onClick={
                        affordable
                          ? () => activateAbility(ability.type)
                          : undefined
                      }
                      aria-pressed={selected}
                      aria-disabled={!affordable}
                      sx={{
                        width: '100%',
                        p: 0,
                        background: 'none',
                        border: 'none',
                        cursor: affordable ? 'pointer' : 'not-allowed',
                        textAlign: 'left',
                        display: 'block',
                      }}
                    >
                      <Box
                        sx={{
                          border: `1px solid ${selected ? ability.accent : affordable ? `${ability.accent}50` : 'rgba(255,255,255,0.1)'}`,
                          borderRadius: '7px',
                          background: selected
                            ? `${ability.accent}12`
                            : affordable
                              ? 'rgba(8,18,30,0.85)'
                              : 'rgba(8,18,30,0.5)',
                          opacity: affordable ? 1 : 0.45,
                          overflow: 'hidden',
                          transition: 'all 0.18s',
                          '&:hover': affordable
                            ? {
                                transform: 'translateY(-1px)',
                                boxShadow: `0 4px 16px ${ability.accent}28`,
                              }
                            : {},
                        }}
                      >
                        {/* Top accent bar */}
                        <Box
                          sx={{
                            height: 2,
                            background: affordable
                              ? ability.accent
                              : 'rgba(255,255,255,0.1)',
                          }}
                        />
                        {/* Content */}
                        <Box
                          sx={{
                            px: 1.8,
                            py: 1.4,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1.5,
                          }}
                        >
                          {/* Icon box */}
                          <Box
                            sx={{
                              width: 40,
                              height: 40,
                              borderRadius: '8px',
                              background: affordable
                                ? `${ability.accent}18`
                                : 'rgba(255,255,255,0.05)',
                              border: `1px solid ${affordable ? `${ability.accent}40` : 'rgba(255,255,255,0.08)'}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: affordable
                                ? ability.accent
                                : 'rgba(180,200,220,0.35)',
                              flexShrink: 0,
                              '& svg': { fontSize: 20 },
                            }}
                          >
                            {ability.icon}
                          </Box>
                          {/* Name + description */}
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography
                              sx={{
                                fontSize: 13,
                                fontWeight: 800,
                                letterSpacing: '0.05em',
                                color: affordable
                                  ? '#eef4f6'
                                  : 'rgba(180,200,220,0.45)',
                                lineHeight: 1.2,
                                textTransform: 'uppercase',
                              }}
                            >
                              {ability.type}
                            </Typography>
                            <Typography
                              sx={{
                                fontSize: 11,
                                color: affordable
                                  ? 'var(--g-muted)'
                                  : 'rgba(180,200,220,0.3)',
                                lineHeight: 1.4,
                                mt: 0.3,
                              }}
                            >
                              {ability.effect}
                            </Typography>
                          </Box>
                          {/* Cost badge */}
                          <Box
                            sx={{
                              flexShrink: 0,
                              textAlign: 'center',
                              minWidth: 42,
                              px: 0.8,
                              py: 0.5,
                              borderRadius: '5px',
                              background: affordable
                                ? `${ability.accent}15`
                                : 'rgba(255,255,255,0.04)',
                              border: `1px solid ${affordable ? `${ability.accent}35` : 'rgba(255,255,255,0.07)'}`,
                            }}
                          >
                            <Typography
                              sx={{
                                fontSize: 16,
                                fontWeight: 900,
                                color: affordable
                                  ? ability.accent
                                  : 'rgba(180,200,220,0.35)',
                                lineHeight: 1,
                                fontVariantNumeric: 'tabular-nums',
                              }}
                            >
                              {cost ?? '—'}
                            </Typography>
                            <Typography
                              sx={{
                                fontSize: 8,
                                fontWeight: 700,
                                letterSpacing: '0.1em',
                                color: affordable
                                  ? `${ability.accent}bb`
                                  : 'rgba(180,200,220,0.25)',
                                lineHeight: 1,
                                mt: 0.25,
                                textTransform: 'uppercase',
                              }}
                            >
                              NRG
                            </Typography>
                          </Box>
                        </Box>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            )}

            {/* Cancel Targeting */}
            {activeAbility && (
              <Button
                onClick={() => setActiveAbility(null)}
                disableRipple
                disableElevation
                sx={ghostBtnSx}
              >
                CANCEL {activeAbility.toUpperCase()} TARGETING
              </Button>
            )}
          </>
        )}
      </Box>
    </>
  );
}
