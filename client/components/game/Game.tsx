import React, { useState } from 'react';
import SurrenderDialog from './SurrenderDialog';
import GameMap from './GameMap';
import LeaderBoard from './LeaderBoard';
import TurnsCount from './TurnsCount';
import OverDialog from './OverDialog';
import CommanderPanel from './CommanderPanel';
import { Box } from '@mui/material';
import { useGame, useGameDispatch } from '@/context/GameContext';

export default function Game() {
  const { room, socketRef, myPlayerId, turnsCount, leaderBoardData } = useGame();
  const { setOpenOverDialog, setDialogContent, setIsSurrendered } = useGameDispatch();
  const [isSurrenderDialogOpen, setSurrenderDialogOpen] = useState(false);

  const handleReturnClick = () => setSurrenderDialogOpen(true);

  const handleSurrender = () => {
    socketRef.current.emit('surrender', myPlayerId);
    setIsSurrendered(true);
    setDialogContent([[null], 'game_surrender', null]);
    setOpenOverDialog(true);
  };

  return (
    <Box
      className="Game"
      sx={{
        display: 'flex',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        background: '#050a14',
      }}
    >
      {/* ── Game Map area (100%) ── */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
        }}
      >
        <TurnsCount count={turnsCount} handleReturnClick={handleReturnClick} />
        <LeaderBoard
          leaderBoardTable={leaderBoardData}
          players={room.players}
          warringStatesMode={room.warringStatesMode}
        />
        <GameMap />
        <SurrenderDialog
          isOpen={isSurrenderDialogOpen}
          setOpen={setSurrenderDialogOpen}
          handleSurrender={handleSurrender}
        />
        <OverDialog />
      </Box>

      {/* ── Floating Commander Panel ── */}
      <Box
        sx={{
          position: 'absolute',
          right: 16,
          top: 64, // below turns/leaderboard roughly
          bottom: 16,
          width: 320,
          zIndex: 10, // above map
          pointerEvents: 'none', // let clicks pass through where there is no UI
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center', // center vertically
        }}
      >
        <Box sx={{
          pointerEvents: 'auto',
          maxHeight: '100%',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 3,
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          border: '1px solid rgba(0, 212, 255, 0.2)',
          background: 'rgba(5, 10, 20, 0.85)',
          backdropFilter: 'blur(12px)',
        }}>
          <CommanderPanel />
        </Box>
      </Box>
    </Box>
  );
}
