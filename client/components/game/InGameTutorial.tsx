import { useRouter } from 'next/router';
import React, {
  CSSProperties,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { useGame } from '@/context/GameContext';
import { MapData, Position, TileType, UserData } from '@/lib/types';
import styles from '@/styles/inGameTutorial.module.css';

type TutorialStep = {
  title: string;
  instruction: string;
  shortAction: string;
};

const STEPS: TutorialStep[] = [
  {
    title: 'Select your General',
    instruction:
      'Click the highlighted blue crown. Your General is your most important tile—protect it.',
    shortAction: 'Click the blue crown',
  },
  {
    title: 'Move your army',
    instruction:
      'With your blue tile selected, press W, A, S, or D to move one square. Keyboard movement is preferred, but you can also click an adjacent tile.',
    shortAction: 'Move with W, A, S, or D',
  },
  {
    title: 'Split your army',
    instruction:
      'With your blue tile selected, press Z to enable 50% movement, then press W, A, S, or D. This moves half your army and leaves troops behind.',
    shortAction: 'Press Z, then move with WASD',
  },
  {
    title: 'How armies grow',
    instruction:
      'Your General produces 1 soldier every 16 seconds. Every plain tile you own produces 1 soldier every 400 seconds, so protecting your General is the fastest way to grow.',
    shortAction: 'General: 16 seconds · Plain tile: 400 seconds',
  },
  {
    title: 'Read the leaderboard',
    instruction:
      'The leaderboard ranks every player and shows total Army and Land. Use it to compare your strength before attacking an opponent.',
    shortAction: 'Army is troop strength · Land is owned tiles',
  },
  {
    title: 'Use squad chat',
    instruction:
      'Use Squad Comms to talk to other players. Press Enter to focus chat quickly, type a message, and press Enter again to send it.',
    shortAction: 'Press Enter to start chatting',
  },
  {
    title: 'Request a Math Challenge',
    instruction:
      'Commander challenges earn Energy and troops. Click the highlighted button to get a practice problem.',
    shortAction: 'Get a Math Challenge',
  },
  {
    title: 'Solve the challenge',
    instruction:
      'Enter an answer and click Verify Answer. A correct answer earns the reward, but the tutorial continues after any submitted answer.',
    shortAction: 'Enter an answer and verify it',
  },
  {
    title: 'Commander abilities',
    instruction:
      'Open the Abilities tab to see tactical actions powered by Energy. The next lessons explain Scout, Reinforce, and Airstrike.',
    shortAction: 'Open the Abilities tab, then continue',
  },
  {
    title: 'Scout',
    instruction:
      'Scout costs 20 Energy and reveals a 5×5 area for about 5 seconds. Choose Scout, then target a tile to inspect hidden territory.',
    shortAction: 'Choose Scout, then target the map',
  },
  {
    title: 'Airstrike',
    instruction:
      'Airstrike costs 40 Energy. Choose it, then target enemy territory. After a short delay, it halves enemy troops in the targeted 3×3 area.',
    shortAction: 'Choose Airstrike, then target the enemy',
  },
  {
    title: 'Reinforce',
    instruction:
      'Open Abilities, choose Reinforce, then target one of your blue tiles. Reinforce spends 50 Energy to add 40 troops.',
    shortAction: 'Use Reinforce on a blue tile',
  },
  {
    title: 'Capture the enemy General',
    instruction:
      'The highlighted red crown is the practice opponent’s General. Build a route to it and attack with more troops than it has to win.',
    shortAction: 'Capture the red crown',
  },
];

const STEP_COMPLETE_HOLD_MS = 1600;
const STEP_EXIT_ANIMATION_MS = 360;
const INFORMATIONAL_STEPS = new Set([3, 4, 5]);
const ABILITY_FEEDBACK_STEPS = new Set([8, 9, 10, 11]);

type Rect = { top: number; left: number; width: number; height: number };
type CardPosition = { top: number; left: number; width: number };
type ScreenPoint = { x: number; y: number };

const viewportRect = (rect: DOMRect, padding = 9): Rect => {
  const left = Math.max(6, rect.left - padding);
  const top = Math.max(6, rect.top - padding);
  const right = Math.min(window.innerWidth - 6, rect.right + padding);
  const bottom = Math.min(window.innerHeight - 6, rect.bottom + padding);
  return {
    left,
    top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
};

const pointOnRectEdge = (rect: Rect, toward: ScreenPoint): ScreenPoint => {
  const center = {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
  const dx = toward.x - center.x;
  const dy = toward.y - center.y;
  if (dx === 0 && dy === 0) return center;
  const horizontalScale = dx === 0 ? Infinity : rect.width / 2 / Math.abs(dx);
  const verticalScale = dy === 0 ? Infinity : rect.height / 2 / Math.abs(dy);
  const scale = Math.min(horizontalScale, verticalScale);
  return {
    x: center.x + dx * scale,
    y: center.y + dy * scale,
  };
};

const countRevealedTiles = (map: MapData) =>
  map.reduce(
    (total, row) =>
      total +
      row.filter(
        ([type]) => type !== TileType.Fog && type !== TileType.Obstacle
      ).length,
    0
  );

export default function InGameTutorial({
  suspended = false,
}: {
  suspended?: boolean;
}) {
  const router = useRouter();
  const { room, socketRef, mapData, initGameInfo, activeAbility, myPlayerId } =
    useGame();
  const [step, setStep] = useState(0);
  const [generalClicked, setGeneralClicked] = useState(false);
  const [moveConfirmed, setMoveConfirmed] = useState(false);
  const [halfMoveConfirmed, setHalfMoveConfirmed] = useState(false);
  const [mathAnswered, setMathAnswered] = useState(false);
  const [abilitiesOpened, setAbilitiesOpened] = useState(false);
  const [scouted, setScouted] = useState(false);
  const [reinforced, setReinforced] = useState(false);
  const [airstruck, setAirstruck] = useState(false);
  const [waitingForAbilityEffect, setWaitingForAbilityEffect] = useState<
    'Scout' | 'Reinforce' | 'Airstrike' | null
  >(null);
  const [won, setWon] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(
    () => new Set()
  );
  const [dismissed, setDismissed] = useState(false);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [cardPosition, setCardPosition] = useState<CardPosition | null>(null);
  const [targetMissing, setTargetMissing] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const practiceEnergyRefilled = useRef(false);
  const completedStepsRef = useRef<Set<number>>(new Set());
  const advanceTimerRef = useRef<number | null>(null);
  const exitTimerRef = useRef<number | null>(null);
  const mapDataRef = useRef(mapData);
  const pendingMoveRef = useRef<{
    step: number;
    isHalf: boolean;
    from: Position;
    to: Position;
    fromUnits: number | null;
    toUnits: number | null;
  } | null>(null);
  const pendingAbilityRef = useRef<{
    abilityType: 'Scout' | 'Reinforce' | 'Airstrike';
    target: Position;
    beforeUnits: number | null;
    beforeRevealed: number;
    serverApplied: boolean;
  } | null>(null);
  mapDataRef.current = mapData;
  const myPlayer = room.players?.find((player) => player.id === myPlayerId);

  useEffect(() => {
    if (!room.isSandbox || !initGameInfo) return;
    const onMapClick = (event: Event) => {
      const { x, y } = (event as CustomEvent<{ x: number; y: number }>).detail;
      if (x === initGameInfo.king.x && y === initGameInfo.king.y) {
        setGeneralClicked(true);
      }
    };
    window.addEventListener('tutorial-map-click', onMapClick);
    return () => window.removeEventListener('tutorial-map-click', onMapClick);
  }, [initGameInfo, room.isSandbox]);

  useEffect(() => {
    if (!room.isSandbox) return;
    const onAbilitiesOpened = () => setAbilitiesOpened(true);
    window.addEventListener('tutorial-abilities-opened', onAbilitiesOpened);
    return () =>
      window.removeEventListener(
        'tutorial-abilities-opened',
        onAbilitiesOpened
      );
  }, [room.isSandbox]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !room.isSandbox) return;
    const onAttackSuccess = (
      from: Position,
      to: Position,
      _turn: number,
      isHalf = false
    ) => {
      const currentStep = Number(document.body.dataset.tutorialStep);
      if (currentStep === 1 || (currentStep === 2 && isHalf)) {
        const visibleMap = mapDataRef.current;
        pendingMoveRef.current = {
          step: currentStep,
          isHalf,
          from,
          to,
          fromUnits: visibleMap[from.x]?.[from.y]?.[2] ?? null,
          toUnits: visibleMap[to.x]?.[to.y]?.[2] ?? null,
        };
      }
    };
    const onMathResult = (result: { status?: string }) => {
      if (result.status === 'SOLVED' || result.status === 'NOT_ACCEPTED') {
        setMathAnswered(true);
      }
    };
    const onAbilityActivated = ({
      abilityType,
      target,
    }: {
      abilityType?: 'Scout' | 'Reinforce' | 'Airstrike';
      target?: Position;
    }) => {
      if (!abilityType || !target) return;
      const visibleMap = mapDataRef.current;
      pendingAbilityRef.current = {
        abilityType,
        target,
        beforeUnits: visibleMap[target.x]?.[target.y]?.[2] ?? null,
        beforeRevealed: countRevealedTiles(visibleMap),
        serverApplied: false,
      };
      setWaitingForAbilityEffect(abilityType);
    };
    const onAbilityEffectApplied = ({
      abilityType,
      target,
    }: {
      abilityType?: string;
      target?: Position;
    }) => {
      const pending = pendingAbilityRef.current;
      if (
        !pending ||
        abilityType !== pending.abilityType ||
        !target ||
        target.x !== pending.target.x ||
        target.y !== pending.target.y
      )
        return;
      pending.serverApplied = true;
    };
    const onCaptured = (_captor: UserData, captured: UserData) => {
      if (captured.username === 'Practice Opponent') setWon(true);
    };
    socket.on('math_result', onMathResult);
    socket.on('ability_activated', onAbilityActivated);
    socket.on('ability_effect_applied', onAbilityEffectApplied);
    socket.on('captured', onCaptured);
    socket.on('attack_success', onAttackSuccess);
    return () => {
      socket.off('math_result', onMathResult);
      socket.off('ability_activated', onAbilityActivated);
      socket.off('ability_effect_applied', onAbilityEffectApplied);
      socket.off('captured', onCaptured);
      socket.off('attack_success', onAttackSuccess);
    };
  }, [room.isSandbox, socketRef]);

  useEffect(() => {
    const pendingMove = pendingMoveRef.current;
    if (pendingMove && myPlayer?.color !== undefined) {
      const fromTile = mapData[pendingMove.from.x]?.[pendingMove.from.y];
      const toTile = mapData[pendingMove.to.x]?.[pendingMove.to.y];
      const moveIsVisible =
        fromTile &&
        toTile &&
        toTile[1] === myPlayer.color &&
        (fromTile[2] !== pendingMove.fromUnits ||
          toTile[2] !== pendingMove.toUnits);
      if (moveIsVisible) {
        pendingMoveRef.current = null;
        if (pendingMove.step === 1) setMoveConfirmed(true);
        else if (pendingMove.step === 2 && pendingMove.isHalf) {
          setHalfMoveConfirmed(true);
        }
      }
    }

    const pendingAbility = pendingAbilityRef.current;
    if (!pendingAbility) return;
    const targetTile =
      mapData[pendingAbility.target.x]?.[pendingAbility.target.y];
    let effectIsVisible = false;
    if (pendingAbility.abilityType === 'Scout') {
      effectIsVisible =
        countRevealedTiles(mapData) > pendingAbility.beforeRevealed;
    } else if (pendingAbility.abilityType === 'Reinforce') {
      effectIsVisible =
        targetTile?.[2] !== null &&
        targetTile?.[2] !== undefined &&
        pendingAbility.beforeUnits !== null &&
        targetTile[2] > pendingAbility.beforeUnits;
    } else if (pendingAbility.abilityType === 'Airstrike') {
      effectIsVisible =
        pendingAbility.serverApplied &&
        targetTile?.[2] !== null &&
        targetTile?.[2] !== undefined &&
        pendingAbility.beforeUnits !== null &&
        targetTile[2] < pendingAbility.beforeUnits;
    }
    if (!effectIsVisible) return;
    pendingAbilityRef.current = null;
    setWaitingForAbilityEffect(null);
    if (pendingAbility.abilityType === 'Scout') setScouted(true);
    else if (pendingAbility.abilityType === 'Reinforce') setReinforced(true);
    else if (pendingAbility.abilityType === 'Airstrike') {
      setAirstruck(true);
    }
  }, [mapData, myPlayer?.color]);

  const refillPracticeEnergy = useCallback(() => {
    if (practiceEnergyRefilled.current || !socketRef.current) return;
    practiceEnergyRefilled.current = true;
    socketRef.current.emit('tutorial_complete');
  }, [socketRef]);

  useEffect(() => {
    if (won) refillPracticeEnergy();
  }, [refillPracticeEnergy, won]);

  const recordStepComplete = useCallback((stepIndex: number) => {
    if (completedStepsRef.current.has(stepIndex)) return;
    const nextCompleted = new Set(completedStepsRef.current);
    nextCompleted.add(stepIndex);
    completedStepsRef.current = nextCompleted;
    setCompletedSteps(nextCompleted);
  }, []);

  const markStepComplete = useCallback(
    (stepIndex: number) => {
      if (completedStepsRef.current.has(stepIndex)) return;
      recordStepComplete(stepIndex);
      setTransitioning(true);
      if (advanceTimerRef.current !== null) {
        window.clearTimeout(advanceTimerRef.current);
      }
      advanceTimerRef.current = window.setTimeout(() => {
        setLeaving(true);
        advanceTimerRef.current = null;
        exitTimerRef.current = window.setTimeout(() => {
          setStep((current) =>
            current === stepIndex
              ? Math.min(current + 1, STEPS.length - 1)
              : current
          );
          setTransitioning(false);
          setLeaving(false);
          exitTimerRef.current = null;
        }, STEP_EXIT_ANIMATION_MS);
      }, STEP_COMPLETE_HOLD_MS);
    },
    [recordStepComplete]
  );

  useEffect(
    () => () => {
      if (advanceTimerRef.current !== null) {
        window.clearTimeout(advanceTimerRef.current);
      }
      if (exitTimerRef.current !== null) {
        window.clearTimeout(exitTimerRef.current);
      }
    },
    []
  );

  useEffect(() => {
    if (!room.isSandbox || dismissed || won) return;
    if (step === 0 && generalClicked) markStepComplete(0);
    else if (step === 1 && moveConfirmed) markStepComplete(1);
    else if (step === 2 && halfMoveConfirmed) markStepComplete(2);
    else if (step === 6 && myPlayer?.activeChallenge) markStepComplete(6);
    else if (step === 7 && mathAnswered) markStepComplete(7);
    else if (step === 8 && abilitiesOpened) markStepComplete(8);
    else if (step === 9 && scouted) markStepComplete(9);
    else if (step === 10 && airstruck) markStepComplete(10);
    else if (step === 11 && reinforced) markStepComplete(11);
  }, [
    abilitiesOpened,
    airstruck,
    dismissed,
    generalClicked,
    halfMoveConfirmed,
    markStepComplete,
    mathAnswered,
    myPlayer?.activeChallenge,
    moveConfirmed,
    reinforced,
    room.isSandbox,
    scouted,
    step,
    won,
  ]);

  const targetSelectors = useCallback((): string[] => {
    if (step === 0) return ['[data-tutorial="my-general"]'];
    if (step === 1 || step === 2 || step === 3)
      return ['[data-tutorial="map-board"]'];
    if (step === 4) return ['[data-tutorial="leaderboard"]'];
    if (step === 5) return ['[data-tutorial="chat"]'];
    if (step === 6)
      return ['[data-tutorial="math-request"]', '[data-tutorial="math-card"]'];
    if (step === 7) return ['[data-tutorial="math-card"]'];
    if (step === 8) return ['[data-tutorial="abilities-tab"]'];
    if (step === 9) {
      if (activeAbility === 'Scout') {
        return ['[data-tutorial="map-board"]'];
      }
      return [
        '[data-tutorial="scout-ability"]',
        '[data-tutorial="abilities-tab"]',
      ];
    }
    if (step === 10) {
      if (activeAbility === 'Airstrike') {
        return ['[data-tutorial="enemy-general"]'];
      }
      return [
        '[data-tutorial="airstrike-ability"]',
        '[data-tutorial="abilities-tab"]',
      ];
    }
    if (step === 11) {
      if (activeAbility === 'Reinforce') {
        return ['[data-tutorial="my-general"]'];
      }
      return [
        '[data-tutorial="reinforce-ability"]',
        '[data-tutorial="abilities-tab"]',
      ];
    }
    if (step === 12)
      return [
        '[data-tutorial="enemy-general"]',
        '[data-tutorial="battlefield"]',
      ];
    return [];
  }, [activeAbility, step]);

  const positionTutorial = useCallback(
    (scrollTarget = false) => {
      if (!room.isSandbox || dismissed || suspended || won) return;
      if (step >= 6 && step <= 11) {
        window.dispatchEvent(new CustomEvent('tutorial-open-commander'));
      }
      const selectors = targetSelectors();
      if (selectors.length === 0) {
        setTargetMissing(false);
        setTargetRect(null);
        setCardPosition(null);
        return;
      }
      const element = selectors
        .map((selector) => document.querySelector<HTMLElement>(selector))
        .find(Boolean);
      if (!element) {
        setTargetMissing(true);
        setTargetRect(null);
        setCardPosition(null);
        return;
      }
      if (scrollTarget) {
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'center',
        });
      }
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const highlight = viewportRect(rect);
      const cardWidth = Math.min(320, window.innerWidth - 24);
      const cardHeight = cardRef.current?.offsetHeight || 190;
      const gap = 18;
      const margin = 12;
      const alignedTop = Math.min(
        window.innerHeight - cardHeight - margin,
        Math.max(margin, highlight.top + highlight.height / 2 - cardHeight / 2)
      );
      const mapBoard = document.querySelector<HTMLElement>(
        '[data-tutorial="map-board"]'
      );
      const mapRect = mapBoard?.getBoundingClientRect();
      const mapCandidates =
        element.dataset.mapTile === 'true' && mapRect
          ? [
              { left: mapRect.right + gap, top: alignedTop },
              { left: mapRect.left - cardWidth - gap, top: alignedTop },
            ]
          : [];
      const candidates = [
        ...mapCandidates,
        {
          left: highlight.left + highlight.width + gap,
          top: alignedTop,
        },
        {
          left: highlight.left - cardWidth - gap,
          top: alignedTop,
        },
        {
          left: highlight.left + highlight.width / 2 - cardWidth / 2,
          top: highlight.top + highlight.height + gap,
        },
        {
          left: highlight.left + highlight.width / 2 - cardWidth / 2,
          top: highlight.top - cardHeight - gap,
        },
      ];
      const fitting = candidates.find(
        ({ left, top }) =>
          left >= margin &&
          top >= margin &&
          left + cardWidth <= window.innerWidth - margin &&
          top + cardHeight <= window.innerHeight - margin
      );
      const chosen = fitting || {
        left: Math.min(
          window.innerWidth - cardWidth - margin,
          Math.max(margin, highlight.left + highlight.width / 2 - cardWidth / 2)
        ),
        top:
          highlight.top > window.innerHeight / 2
            ? margin
            : Math.max(margin, window.innerHeight - cardHeight - margin),
      };
      setTargetMissing(false);
      setTargetRect(highlight);
      setCardPosition({ ...chosen, width: cardWidth });
    },
    [dismissed, room.isSandbox, step, suspended, targetSelectors, won]
  );

  useLayoutEffect(() => {
    if (!room.isSandbox || dismissed || suspended || won) return;
    const revealAbilityControl = step >= 8 && step <= 11 && !activeAbility;
    positionTutorial(revealAbilityControl);
    const delayed = window.setTimeout(() => positionTutorial(), 380);
    const updatePosition = () => positionTutorial();
    const resizeObserver = new ResizeObserver(() => positionTutorial());
    const mutationObserver = new MutationObserver(() => positionTutorial());
    resizeObserver.observe(document.documentElement);
    mutationObserver.observe(
      document.querySelector('.g-game-layout') || document.body,
      {
        attributes: true,
        attributeFilter: ['style', 'data-tutorial'],
        childList: true,
        subtree: true,
      }
    );
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.clearTimeout(delayed);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [
    activeAbility,
    dismissed,
    positionTutorial,
    room.isSandbox,
    step,
    suspended,
    won,
  ]);

  useEffect(() => {
    if (!room.isSandbox) return;
    document.body.dataset.tutorialStep = won ? 'complete' : String(step);
    return () => {
      delete document.body.dataset.tutorialStep;
    };
  }, [room.isSandbox, step, won]);

  const finishTutorial = () => {
    refillPracticeEnergy();
    setDismissed(true);
  };

  const navigateTutorial = (nextStep: number) => {
    if (leaving) return;
    if (advanceTimerRef.current !== null) {
      window.clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
    if (exitTimerRef.current !== null) {
      window.clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
    if (nextStep > step && INFORMATIONAL_STEPS.has(step)) {
      recordStepComplete(step);
    }
    setTransitioning(false);
    setLeaving(true);
    exitTimerRef.current = window.setTimeout(() => {
      setStep(Math.max(0, Math.min(nextStep, STEPS.length - 1)));
      setLeaving(false);
      exitTimerRef.current = null;
    }, STEP_EXIT_ANIMATION_MS);
  };

  if (
    !room.isSandbox ||
    dismissed ||
    suspended ||
    typeof document === 'undefined'
  )
    return null;

  const current = STEPS[step];
  const hasTarget = targetSelectors().length > 0;
  const cardStyle: CSSProperties = cardPosition
    ? {
        top: cardPosition.top,
        left: cardPosition.left,
        width: cardPosition.width,
      }
    : !hasTarget
      ? { right: 24, bottom: 24, width: 'min(320px, calc(100vw - 24px))' }
      : { left: '50%', top: 16, width: 'min(320px, calc(100vw - 24px))' };
  const cardCenter = cardPosition
    ? {
        x: cardPosition.left + cardPosition.width / 2,
        y: cardPosition.top + (cardRef.current?.offsetHeight || 190) / 2,
      }
    : null;
  const targetCenter = targetRect
    ? {
        x: targetRect.left + targetRect.width / 2,
        y: targetRect.top + targetRect.height / 2,
      }
    : null;
  const cardRect = cardPosition
    ? {
        ...cardPosition,
        height: cardRef.current?.offsetHeight || 190,
      }
    : null;
  const connectorStart =
    cardRect && targetCenter ? pointOnRectEdge(cardRect, targetCenter) : null;
  const connectorEnd =
    targetRect && cardCenter ? pointOnRectEdge(targetRect, cardCenter) : null;

  return createPortal(
    <div className={styles.tutorialLayer} aria-live='polite'>
      {targetRect && !won ? (
        <>
          <div
            className={styles.shade}
            style={{ left: 0, top: 0, right: 0, height: targetRect.top }}
          />
          <div
            className={styles.shade}
            style={{
              left: 0,
              top: targetRect.top,
              width: targetRect.left,
              height: targetRect.height,
            }}
          />
          <div
            className={styles.shade}
            style={{
              left: targetRect.left + targetRect.width,
              top: targetRect.top,
              right: 0,
              height: targetRect.height,
            }}
          />
          <div
            className={styles.shade}
            style={{
              left: 0,
              top: targetRect.top + targetRect.height,
              right: 0,
              bottom: 0,
            }}
          />
          <div className={styles.targetRing} style={targetRect}>
            <span>DO THIS</span>
          </div>
        </>
      ) : won ? (
        <div className={styles.fullShade} />
      ) : null}

      {connectorStart && connectorEnd && !won && (
        <svg
          className={styles.connector}
          viewBox={`0 0 ${window.innerWidth} ${window.innerHeight}`}
          aria-hidden='true'
        >
          <defs>
            <marker
              id='tutorial-arrow'
              markerWidth='10'
              markerHeight='10'
              refX='7'
              refY='3'
              orient='auto'
            >
              <path d='M0,0 L0,6 L8,3 z' />
            </marker>
          </defs>
          <line
            x1={connectorStart.x}
            y1={connectorStart.y}
            x2={connectorEnd.x}
            y2={connectorEnd.y}
            markerEnd='url(#tutorial-arrow)'
          />
        </svg>
      )}

      <div
        key={won ? 'complete' : step}
        ref={cardRef}
        className={`${styles.tutorialBox} ${won ? styles.completeBox : ''} ${!cardPosition && hasTarget ? styles.fallbackBox : ''} ${!hasTarget ? styles.infoBox : ''} ${leaving ? styles.leaving : ''}`}
        style={won ? undefined : cardStyle}
        role='dialog'
        aria-modal='false'
        aria-labelledby='tutorial-title'
      >
        {won ? (
          <>
            <span className={styles.kicker}>TUTORIAL COMPLETE</span>
            <h2 id='tutorial-title'>You captured the enemy General!</h2>
            <p>
              That is how you win. Your Energy has been refilled to 1000, and
              this training room will stay open so you can keep exploring.
            </p>
            <div className={styles.completionActions}>
              <button className={styles.primaryButton} onClick={finishTutorial}>
                Continue free practice
              </button>
              <button onClick={() => void router.push('/')}>
                Exit tutorial
              </button>
            </div>
          </>
        ) : (
          <>
            <div className={styles.stepHeader}>
              <span className={styles.kicker}>INTERACTIVE TUTORIAL</span>
              <span>
                STEP {step + 1} OF {STEPS.length}
              </span>
            </div>
            <h2 id='tutorial-title'>{current.title}</h2>
            <p>{current.instruction}</p>
            <div className={styles.actionPrompt}>
              <span aria-hidden='true'>➜</span>
              <b>{current.shortAction}</b>
            </div>
            {transitioning && (
              <p className={styles.transitionNotice}>Done — next lesson…</p>
            )}
            {waitingForAbilityEffect &&
              !transitioning &&
              [9, 10, 11].includes(step) && (
                <p className={styles.effectWaiting}>
                  {waitingForAbilityEffect} deployed — waiting for its effect to
                  appear…
                </p>
              )}
            {targetMissing && (
              <p className={styles.waiting}>
                Preparing the highlighted control…
              </p>
            )}
            <div
              className={styles.progress}
              aria-label={`Step ${step + 1} of ${STEPS.length}`}
            >
              {STEPS.map((item, index) => (
                <i
                  key={item.title}
                  className={
                    index === step
                      ? styles.current
                      : completedSteps.has(index)
                        ? styles.done
                        : ''
                  }
                />
              ))}
            </div>
            <div className={styles.stepNavigation}>
              <button
                disabled={step === 0 || leaving}
                onClick={() => navigateTutorial(step - 1)}
              >
                ← Previous
              </button>
              {!ABILITY_FEEDBACK_STEPS.has(step) && (
                <button
                  disabled={step === STEPS.length - 1 || leaving}
                  onClick={() => navigateTutorial(step + 1)}
                >
                  Next →
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
