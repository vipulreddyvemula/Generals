import React, { useEffect, useState, useRef } from 'react';
import { useGame } from '@/context/GameContext';
import { AbilityType, Position } from '@/lib/types';
import FlightIcon from '@mui/icons-material/Flight';

interface AirstrikeEffectProps {
  zoom: number;
  tileSize: number;
  onExploding?: (exploding: boolean) => void;
}

interface ActiveAirstrike {
  id: string; // unique ID for tracking
  center: Position;
  expiresAtTurn: number;
  phase: 'incoming' | 'exploding';
}

const AirstrikeEffect: React.FC<AirstrikeEffectProps> = ({ zoom, tileSize, onExploding }) => {
  const { room, turnsCount } = useGame();
  const [airstrikes, setAirstrikes] = useState<ActiveAirstrike[]>([]);
  const prevEffectsRef = useRef<any[]>([]);

  // Calculate pixel size for the 3x3 area
  const explosionSize = tileSize * zoom * 3;
  const tilePixelSize = tileSize * zoom;

  useEffect(() => {
    if (!room?.map) return;
    const currentEffects = room.map.activeEffects || [];
    const turn = turnsCount;

    setAirstrikes((currentAirstrikes) => {
      const nextAirstrikes = [...currentAirstrikes];

      // Find new airstrike effects from the server
      currentEffects.forEach((effect: any) => {
        if (effect.type === AbilityType.Airstrike) {
          const id = `${effect.center.x}-${effect.center.y}-${effect.expiresAtTurn}`;
          if (!nextAirstrikes.find((a) => a.id === id)) {
            nextAirstrikes.push({
              id,
              center: effect.center,
              expiresAtTurn: effect.expiresAtTurn,
              phase: 'incoming',
            });
          }
        }
      });

      // Update phases based on current turn
      return nextAirstrikes.map((airstrike) => {
        // If it was incoming but the turn has passed (or is about to), switch to exploding
        if (airstrike.phase === 'incoming' && turn >= airstrike.expiresAtTurn) {
          return { ...airstrike, phase: 'exploding' as const };
        }
        return airstrike;
      }).filter((airstrike) => {
        // Remove exploding airstrikes after they've been exploding for 2 turns (~1 second)
        // or just let them live a little longer so the CSS animation finishes
        return turn <= airstrike.expiresAtTurn + 3; 
      });
    });

    prevEffectsRef.current = currentEffects;
  }, [room?.map?.activeEffects, turnsCount]);

  useEffect(() => {
    // Notify parent if any airstrike is exploding (for map shake)
    const isExploding = airstrikes.some((a) => a.phase === 'exploding');
    if (onExploding) {
      onExploding(isExploding);
    }
  }, [airstrikes, onExploding]);

  if (airstrikes.length === 0) return null;

  return (
    <>
      <style>{`
        @keyframes airstrike-target {
          0% { opacity: 0.2; transform: scale(0.8); }
          50% { opacity: 0.8; transform: scale(1.1); }
          100% { opacity: 0.2; transform: scale(0.8); }
        }
        @keyframes airstrike-flyover {
          0% {
            transform: translate(-300px, -300px) scale(0.5) rotate(90deg);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            transform: translate(300px, 300px) scale(1.5) rotate(90deg);
            opacity: 0;
          }
        }
        @keyframes airstrike-explode {
          0% {
            transform: scale(0);
            opacity: 1;
            background-color: #ffaa00;
          }
          20% {
            transform: scale(1.5);
            opacity: 1;
            background-color: #ff3300;
          }
          50% {
            transform: scale(1.2);
            opacity: 0.8;
            background-color: #cc0000;
          }
          100% {
            transform: scale(2);
            opacity: 0;
            background-color: #333333;
          }
        }
        .airstrike-container {
          position: absolute;
          pointer-events: none;
          z-index: 50;
        }
        .airstrike-target {
          position: absolute;
          background-color: rgba(255, 0, 0, 0.2);
          border: 2px dashed red;
          animation: airstrike-target 0.5s infinite;
        }
        .airstrike-bomber {
          position: absolute;
          font-size: 60px;
          animation: airstrike-flyover 3s linear forwards;
          transform-origin: center;
        }
        .airstrike-explosion {
          position: absolute;
          border-radius: 50%;
          animation: airstrike-explode 0.8s ease-out forwards;
          box-shadow: 0 0 20px #ff3300;
        }
      `}</style>
      
      {airstrikes.map((airstrike) => {
        // Map x, y are swapped in display?
        // Wait, in GameMap: top is translate(position.x, position.y)? 
        // GameMap line 464: transform: `translate(-50%, -50%) translate(${position.x}px, ${position.y}px)`
        // And inside, x corresponds to height/rows, y corresponds to width/cols ?
        // Let's check GameMap lines 473-477: displayMapData.map((tiles, x) => tiles.map((tile, y) => <div key={`${x}/${y}`}> <MapTile x={x} y={y} />
        // Note: x is row index (vertical), y is col index (horizontal).
        // Let's position things absolutely within the map container. Wait, GameMap renders MapTiles statically in a grid? 
        // Actually, MapTile uses absolute positioning inside? Let's check MapTile.
        
        // Wait, if GameMap renders them as a grid, the map container might just be a relative container.
        // GameMap div style has no display: grid or flex. Wait, how are MapTiles positioned?
        // I need to know how MapTiles are positioned to match it!
        // I will just use standard top/left based on tilePixelSize.
        // MapTile position: x is row, y is column. 
        // So top = x * tilePixelSize, left = y * tilePixelSize.

        const top = (airstrike.center.x - 1) * tilePixelSize;
        const left = (airstrike.center.y - 1) * tilePixelSize;
        const centerTop = airstrike.center.x * tilePixelSize;
        const centerLeft = airstrike.center.y * tilePixelSize;

        return (
          <div key={airstrike.id} className="airstrike-container" style={{ top: 0, left: 0 }}>
            {airstrike.phase === 'incoming' && (
              <>
                <div 
                  className="airstrike-target"
                  style={{
                    top,
                    left,
                    width: explosionSize,
                    height: explosionSize,
                  }}
                />
                <div 
                  className="airstrike-bomber"
                  style={{
                    top: centerTop - 30, // center the 60px icon
                    left: centerLeft - 30,
                  }}
                >
                  ✈️
                </div>
              </>
            )}
            
            {airstrike.phase === 'exploding' && (
              <>
                {/* 9 explosions for the 3x3 grid */}
                {[-1, 0, 1].map(dx => (
                  [-1, 0, 1].map(dy => (
                    <div 
                      key={`${dx}-${dy}`}
                      className="airstrike-explosion"
                      style={{
                        top: (airstrike.center.x + dx) * tilePixelSize,
                        left: (airstrike.center.y + dy) * tilePixelSize,
                        width: tilePixelSize,
                        height: tilePixelSize,
                        animationDelay: `${Math.random() * 0.2}s`
                      }}
                    />
                  ))
                ))}
              </>
            )}
          </div>
        );
      })}
    </>
  );
};

export default AirstrikeEffect;
