import React, { useState, useEffect } from 'react';
import { useTranslation } from 'next-i18next';
import { useGame } from '@/context/GameContext';

export function InGameTutorial({ run, onFinish }: { run: boolean; onFinish: () => void }) {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(0);
  
  // Game Context for Action Tracking
  const { leaderBoardData, room, myPlayerId } = useGame();
  const myPlayerColor = room.players?.find((p) => p.id === myPlayerId)?.color;
  const myLand = leaderBoardData?.find((row) => row[0] === myPlayerColor)?.[3] || 1;
  const myEnergy = room.players?.find((p) => p.id === myPlayerId)?.energy || 0;
  const myActiveChallenge = room.players?.find((p) => p.id === myPlayerId)?.activeChallenge || null;
  const myActiveCf = room.players?.find((p) => p.id === myPlayerId)?.activeCodeforcesChallenge || null;

  const steps = React.useMemo(() => [
    {
      target: 'body',
      title: 'Welcome to Commander Mode!',
      content: 'Let\'s take a quick tour of the battlefield. To proceed through action steps, you must successfully perform the action!',
      placement: 'center',
    },
    {
      target: '.g-game-battlefield',
      title: 'Movement Basics',
      content: 'Use W, A, S, D or the Arrow Keys to move your troops! Select your General and capture an adjacent tile to continue.',
      placement: 'center',
      actionRequired: 'MOVE_ONCE',
    },
    {
      target: '.g-tutorial-math',
      title: 'Generate Energy: Math',
      content: 'Click "Get Math Challenge" to earn a steady stream of energy and troops.',
      placement: 'left',
      actionRequired: 'START_MATH',
    },
    {
      target: '.g-tutorial-codeforces',
      title: 'Generate Energy: Codeforces',
      content: 'Sync your Codeforces handle and receive a competitive programming problem. Once you submit a correct answer on Codeforces, you will earn massive rewards.',
      placement: 'left',
      actionRequired: 'START_CF',
    },
    {
      target: '.g-tutorial-abilities-tab',
      title: 'Using Abilities',
      content: 'Once you have enough energy, click the ABILITIES tab and cast a game-changing power like Scout or Airstrike!',
      placement: 'left',
      actionRequired: 'CAST_ABILITY',
    },
    {
      target: 'body',
      title: 'Mountain Tiles',
      content: 'Mountains are impassable terrain. You must move around them to reach your opponent!',
      placement: 'center',
    },
    {
      target: '.g-game-left',
      title: 'The Leaderboard',
      content: 'Keep track of enemy troops, land, and energy. Capture enemy territory to increase yours.',
      placement: 'right',
    },
    {
      target: '.g-game-clock',
      title: 'Turn Clock',
      content: 'Your General generates 1 soldier every 16 seconds. Every plain tile you own generates 1 soldier every 400 seconds.',
      placement: 'bottom',
    },
  ], []);

  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const handleNext = React.useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(c => c + 1);
    } else {
      setCurrentStep(0);
      onFinish();
    }
  }, [currentStep, steps.length, onFinish]);
  
  const handleSkip = () => {
    setCurrentStep(0);
    onFinish();
  };

  // --- Action Tracker ---
  const [landBaseline, setLandBaseline] = useState<number | null>(null);
  const [energyBaseline, setEnergyBaseline] = useState<number | null>(null);

  useEffect(() => {
    if (!run) return;
    const step = steps[currentStep];
    if (!step) return;
    
    if (step.actionRequired === 'MOVE_ONCE') {
      if (landBaseline === null) setLandBaseline(myLand);
      else if (myLand > landBaseline) {
        setLandBaseline(null); // reset for future
        handleNext();
      }
    }
    
    if (step.actionRequired === 'START_MATH') {
      if (myActiveChallenge) {
        handleNext();
      }
    }
    
    if (step.actionRequired === 'START_CF') {
      if (myActiveCf) {
        handleNext();
      }
    }
    
    if (step.actionRequired === 'CAST_ABILITY') {
      if (energyBaseline === null) setEnergyBaseline(myEnergy);
      else if (myEnergy > energyBaseline) setEnergyBaseline(myEnergy); // player earned more energy
      else if (myEnergy < energyBaseline - 5) { // player spent energy (costs are usually > 10)
        setEnergyBaseline(null);
        handleNext();
      }
    }
    
  }, [run, currentStep, steps, myLand, myEnergy, myActiveChallenge, myActiveCf, landBaseline, energyBaseline, handleNext]);

  // --- Target Positioning ---
  useEffect(() => {
    if (!run) return;
    const step = steps[currentStep];
    if (!step) return;
    if (step.target === 'body') {
      setTargetRect(null);
      return;
    }
    
    const element = document.querySelector(step.target);
    if (element) {
      setTargetRect(element.getBoundingClientRect());
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      setTargetRect(null);
    }
  }, [run, currentStep, steps]);

  const step = steps[currentStep] || steps[0];

  // Determine Tooltip styles
  let tooltipStyle: React.CSSProperties = {
    position: 'absolute',
    backgroundColor: '#0a1432',
    border: '2px solid #00d4ff',
    padding: '16px',
    borderRadius: '8px',
    color: '#fff',
    zIndex: 10001,
    maxWidth: '300px',
    boxShadow: '0 4px 12px rgba(0,212,255,0.2)',
  };

  if (step.target === 'body' || !targetRect) {
    tooltipStyle = {
      ...tooltipStyle,
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
    };
  } else {
    // Basic positioning around the target
    if (step.placement === 'top') {
      tooltipStyle.top = Math.max(0, targetRect.top - 20) + 'px';
      tooltipStyle.left = targetRect.left + (targetRect.width / 2) + 'px';
      tooltipStyle.transform = 'translate(-50%, -100%)';
    } else if (step.placement === 'bottom') {
      tooltipStyle.top = (targetRect.bottom + 20) + 'px';
      tooltipStyle.left = targetRect.left + (targetRect.width / 2) + 'px';
      tooltipStyle.transform = 'translate(-50%, 0)';
    } else if (step.placement === 'left') {
      tooltipStyle.top = targetRect.top + (targetRect.height / 2) + 'px';
      tooltipStyle.left = Math.max(0, targetRect.left - 20) + 'px';
      tooltipStyle.transform = 'translate(-100%, -50%)';
    } else if (step.placement === 'right') {
      tooltipStyle.top = targetRect.top + (targetRect.height / 2) + 'px';
      tooltipStyle.left = (targetRect.right + 20) + 'px';
      tooltipStyle.transform = 'translate(0, -50%)';
    } else if (step.placement === 'center') {
      tooltipStyle.top = targetRect.top + (targetRect.height / 2) + 'px';
      tooltipStyle.left = targetRect.left + (targetRect.width / 2) + 'px';
      tooltipStyle.transform = 'translate(-50%, -50%)';
    }
  }

  const tooltipRef = React.useRef<HTMLDivElement>(null);
  
  // Auto-adjust if it overflows
  useEffect(() => {
    if (tooltipRef.current) {
      // Reset to original to get accurate fresh bounds
      tooltipRef.current.style.transform = tooltipStyle.transform as string;
      
      const rect = tooltipRef.current.getBoundingClientRect();
      let dx = 0;
      let dy = 0;
      if (rect.left < 10) dx = 10 - rect.left;
      if (rect.right > window.innerWidth - 10) dx = window.innerWidth - 10 - rect.right;
      if (rect.top < 10) dy = 10 - rect.top;
      if (rect.bottom > window.innerHeight - 10) dy = window.innerHeight - 10 - rect.bottom;

      if (dx !== 0 || dy !== 0) {
        tooltipRef.current.style.transform = `${tooltipStyle.transform} translate(${dx}px, ${dy}px)`;
      }
    }
  }, [currentStep, targetRect, tooltipStyle.transform]);

  if (!run || !steps[currentStep]) return null;

  return (
    <>
      <div 
        style={{ 
          position: 'fixed', 
          top: 0, left: 0, right: 0, bottom: 0, 
          backgroundColor: targetRect && step.target !== 'body' ? 'transparent' : 'rgba(0,0,0,0.4)', 
          zIndex: 10000,
          pointerEvents: 'none'
        }}
      />
      {targetRect && step.target !== 'body' && (
        <div 
          style={{
            position: 'absolute',
            top: targetRect.top - 4,
            left: targetRect.left - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
            border: '2px dashed #00d4ff',
            borderRadius: '4px',
            pointerEvents: 'none',
            zIndex: 10000,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.4)',
          }}
        />
      )}
      <div ref={tooltipRef} style={tooltipStyle}>
        <h3 style={{ marginTop: 0, color: '#00d4ff' }}>{step.title}</h3>
        <p style={{ lineHeight: 1.5 }}>{step.content}</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
          <button 
            onClick={handleSkip}
            style={{ 
              background: 'transparent', 
              color: 'rgba(255,255,255,0.5)', 
              border: 'none', 
              cursor: 'pointer' 
            }}
          >
            Skip
          </button>
          {!step.actionRequired && (
            <button 
              onClick={handleNext}
              style={{ 
                background: '#00d4ff', 
                color: '#050a19', 
                border: 'none', 
                padding: '6px 16px', 
                borderRadius: '4px', 
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              {currentStep === steps.length - 1 ? 'Finish' : 'Next'}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
