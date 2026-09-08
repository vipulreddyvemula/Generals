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
      {/* ── Game Map area (65%) ── */}
      <Box
        sx={{
          position: 'relative',
          flex: '0 0 65%',
          maxWidth: '65%',
          height: '100%',
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

      {/* ── Commander Panel (35%) ── */}
      <Box
        sx={{
          flex: '0 0 35%',
          maxWidth: '35%',
          height: '100%',
          overflow: 'hidden',
        }}
      >
        <CommanderPanel />
      </Box>
    </Box>
  );
}
