import React, { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
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
  border: '1px solid rgba(63, 118, 191, .52)',
  background: 'rgba(4, 15, 24, .56)',
  borderRadius: '5px',
  p: 1.7,
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
    effect: 'Reveals area (7x7)',
  },
  {
    type: AbilityType.Reinforce,
    icon: <UpgradeIcon />,
    accent: '#2868d8',
    effect: 'Spawns troops on target',
  },
  {
    type: AbilityType.Airstrike,
    icon: <FlightTakeoffIcon />,
    accent: '#ff4b4b',
    effect: 'Halves troops on target',
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
  const [connected, setConnected] = useState(
    Boolean(socketRef.current?.connected)
  );

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
          title: 'NOT ACCEPTED YET',
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
        title: 'QUEUE COMPLETE',
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
    socket.on('codeforces_history_ready', onCfHistoryReady);
    socket.on('codeforces_queue_status', onCfQueueStatus);
    socket.on('codeforces_challenge', onCfChallenge);
    socket.on('codeforces_queue_exhausted', onCfQueueExhausted);
    socket.on('codeforces_verification_pending', onVerifyPending);
    socket.on('codeforces_verification_result', onVerifyResult);
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
  const cfPlayerReady = Boolean(
    cfQueueStatus?.readyPlayerIds.includes(myPlayerId)
  );
  return (
    <Box
      className='g-commander'
      sx={{
        color: '#eaf2fa',
        fontFamily: 'Roboto, sans-serif',
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.3,
        height: '100%',
        minHeight: 0,
        overflowY: 'auto',
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
              fontFamily: 'Cinzel, serif',
              fontSize: 20,
              letterSpacing: 1.5,
              color: '#d9b765',
              fontWeight: 800,
            }}
          >
            COMMANDER
          </Typography>
          <Typography
            sx={{
              fontSize: 9,
              color: 'rgba(220,235,249,.55)',
              letterSpacing: 1.8,
            }}
          >
            TACTICAL UPLINK
          </Typography>
        </Box>
        <Box
          sx={{
            width: 'auto',
            height: 'auto',
            color: connected ? '#45d992' : '#e87378',
            fontSize: 10,
            '&::after': { content: connected ? '"● ONLINE"' : '"● OFFLINE"' },
          }}
        />
      </Box>

      <Box
        sx={{
          ...cardSx,
          background: 'rgba(4, 16, 25, .6)',
          borderColor: 'rgba(104,148,171,.34)',
        }}
      >
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
              / {room?.isSandbox ? 1000 : commanderConfig?.maxEnergy || 100}
            </Box>
          </Typography>
        </Box>
        <LinearProgress
          variant='determinate'
          value={Math.min(
            100,
            (energy /
              (room?.isSandbox ? 1000 : commanderConfig?.maxEnergy || 100)) *
              100
          )}
          sx={{
            height: 11,
            borderRadius: 6,
            bgcolor: 'rgba(255,255,255,.07)',
            '& .MuiLinearProgress-bar': {
              bgcolor: '#2868d8',
              boxShadow: '0 0 12px rgba(40,104,216,.5)',
              transition: 'transform .65s cubic-bezier(.2,.8,.2,1)',
            },
          }}
        />
      </Box>

      <Tabs
        value={activeTab}
        onChange={(_, newValue) => {
          setActiveTab(newValue);
          if (room?.isSandbox && newValue === 'ABILITIES') {
            window.dispatchEvent(new CustomEvent('tutorial-abilities-opened'));
          }
        }}
        variant='fullWidth'
        sx={{
          minHeight: 42,
          '& .MuiTab-root': {
            minHeight: 42,
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: 1.2,
            color: 'rgba(231,242,252,.7)',
            p: 0,
            border: '1px solid rgba(104,148,171,.34)',
            borderRadius: '5px',
            marginX: 0.4,
          },
          '& .Mui-selected': {
            color: '#fff !important',
            backgroundColor: '#2868d8',
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

      {activeTab === 'CHALLENGES' && (
        <>
          <Box
            data-tutorial='math-card'
            sx={{ ...cardSx, borderColor: 'rgba(70,124,216,.52)' }}
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
                  fontSize: 12,
                  fontWeight: 900,
                  letterSpacing: 0.8,
                }}
              >
                <PsychologyAltOutlinedIcon
                  sx={{ fontSize: 19, color: '#8baeff' }}
                />
                MATH CHALLENGE
              </Typography>
            </Box>
            {mathChallenge ? (
              <>
                <Typography
                  sx={{
                    fontSize: 15,
                    fontWeight: 700,
                    lineHeight: 1.35,
                    minHeight: 34,
                    mt: 1.5,
                  }}
                >
                  {mathChallenge.question}
                </Typography>
                <Box
                  component='form'
                  onSubmit={submitMath}
                  sx={{ display: 'grid', gap: 1.2, mt: 1.5 }}
                >
                  <TextField
                    value={mathAnswer}
                    onChange={(event) => setMathAnswer(event.target.value)}
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
                        '& fieldset': { borderColor: 'rgba(104,148,171,.45)' },
                      },
                    }}
                  />
                  <Button
                    className='tutorial-math-submit-btn'
                    type='submit'
                    disabled={!mathAnswer.trim()}
                    sx={{
                      minWidth: 72,
                      minHeight: 40,
                      color: '#fff',
                      bgcolor: '#2868d8',
                      '&:hover': { bgcolor: '#347cf3' },
                      fontSize: 12,
                      fontWeight: 900,
                    }}
                  >
                    Verify Answer
                  </Button>
                </Box>
              </>
            ) : (
              <Box sx={{ display: 'grid', gap: 1.2, mt: 1.3 }}>
                <Typography sx={{ fontSize: 12, color: '#a4b4c2' }}>
                  Request a tactical question to solve in-game.
                </Typography>
                <Button
                  data-tutorial='math-request'
                  className='tutorial-math-btn'
                  onClick={requestMath}
                  disabled={mathCooldown}
                  sx={{
                    color: '#fff',
                    bgcolor: '#2868d8',
                    '&:hover': { bgcolor: '#347cf3' },
                    fontSize: 12,
                    fontWeight: 800,
                  }}
                >
                  {mathCooldown ? 'Recharging' : 'Get Math Challenge'}
                </Button>
              </Box>
            )}
          </Box>

          <Box
            sx={{
              ...cardSx,
              borderColor: 'rgba(70,124,216,.58)',
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
                  fontSize: 12,
                  fontWeight: 900,
                  letterSpacing: 0.8,
                }}
              >
                <CodeOutlinedIcon sx={{ fontSize: 19, color: '#80aaff' }} />
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
                  color: cfStatus === 'ACCEPTED' ? '#45d992' : '#89b4ff',
                  bgcolor: 'rgba(40,104,216,.14)',
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
                    color: '#a4b4c2',
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
                      <OpenInNewIcon sx={{ fontSize: '14px !important' }} />
                    }
                    sx={{
                      color: '#89b4ff',
                      border: '1px solid rgba(70,124,216,.52)',
                      minHeight: 38,
                      fontSize: 11,
                      fontWeight: 900,
                      width: '100%',
                    }}
                  >
                    Open in Codeforces
                  </Button>
                  <Button
                    onClick={verifyCodeforces}
                    disabled={
                      cfStatus === 'VERIFYING' || cfStatus === 'ACCEPTED'
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
                    sx={{
                      color: '#fff',
                      bgcolor: '#2868d8',
                      '&:hover': { bgcolor: '#347cf3' },
                      minHeight: 40,
                      fontSize: 11,
                      fontWeight: 900,
                      width: '100%',
                    }}
                  >
                    {cfStatus === 'VERIFYING'
                      ? 'Checking…'
                      : cfStatus === 'ACCEPTED'
                        ? 'Accepted'
                        : 'Verify Solution'}
                  </Button>
                </Box>
              </>
            ) : (
              <>
                <Typography sx={{ fontSize: 12, color: '#a4b4c2', mb: 1 }}>
                  Your Codeforces handle was checked before the match. Request
                  your assigned challenge when ready.
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
                    sx={{
                      width: '100%',
                      color: '#fff',
                      bgcolor: '#2868d8',
                      '&:hover': { bgcolor: '#347cf3' },
                      '&.Mui-disabled': {
                        bgcolor: 'rgba(40,104,216,.4)',
                        color: 'rgba(255,255,255,.5)',
                      },
                      fontSize: 9,
                      fontWeight: 900,
                    }}
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

      {activeTab === 'ABILITIES' && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 1,
          }}
        >
          {abilities.map((ability) => {
            const cost = commanderConfig?.abilities[ability.type]?.energy;
            const affordable = typeof cost === 'number' && energy >= cost;
            const selected = activeAbility === ability.type;
            return (
              <Button
                data-tutorial={`${ability.type.toLowerCase()}-ability`}
                className={`tutorial-ability-${ability.type.toLowerCase()}`}
                key={ability.type}
                onClick={
                  affordable ? () => activateAbility(ability.type) : undefined
                }
                aria-pressed={selected}
                aria-disabled={!affordable}
                sx={{
                  minWidth: 0,
                  p: 1.8,
                  minHeight: 112,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 0.5,
                  cursor: affordable ? 'pointer' : 'not-allowed',
                  color: affordable ? ability.accent : 'rgba(180,200,220,.6)',
                  border: `1px solid ${selected ? ability.accent : affordable ? `${ability.accent}55` : 'rgba(180,200,220,.25)'}`,
                  borderRadius: '6px',
                  bgcolor: selected
                    ? `${ability.accent}18`
                    : affordable
                      ? 'rgba(8,16,28,.72)'
                      : 'rgba(8,16,28,.5)',
                  '& svg': { fontSize: 24 },
                  '&:hover': affordable
                    ? undefined
                    : { bgcolor: 'rgba(8,16,28,.5)' },
                }}
              >
                {ability.icon}
                <Typography
                  sx={{ fontSize: 11, fontWeight: 900, letterSpacing: 0.5 }}
                >
                  {ability.type.toUpperCase()}
                </Typography>
                <Typography sx={{ fontSize: 11, fontWeight: 900 }}>
                  {cost ?? '—'} ENERGY
                </Typography>
                <Typography
                  sx={{ fontSize: 9, color: 'inherit', opacity: 0.75 }}
                >
                  {ability.effect}
                </Typography>
              </Button>
            );
          })}
        </Box>
      )}
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
