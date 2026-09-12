import React, { useEffect, useState } from 'react';
import SurrenderDialog from './SurrenderDialog';
import GameMap from './GameMap';
import LeaderBoard from './LeaderBoard';
import TurnsCount from './TurnsCount';
import OverDialog from './OverDialog';
import CommanderPanel from './CommanderPanel';
import { Box } from '@mui/material';
import { useGame, useGameDispatch } from '@/context/GameContext';

export default function Game() {
  const { room, socketRef, turnsCount, leaderBoardData } = useGame();
  const { setOpenOverDialog, setDialogContent, setIsSurrendered } =
    useGameDispatch();
  const [isSurrenderDialogOpen, setSurrenderDialogOpen] = useState(false);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    const onSurrenderResult = (result: { status: string }) => {
      if (result.status !== 'ACCEPTED') return;
      setIsSurrendered(true);
      setDialogContent([[null], 'game_surrender', null]);
      setOpenOverDialog(true);
    };
    socket.on('surrender_result', onSurrenderResult);
    return () => {
      socket.off('surrender_result', onSurrenderResult);
    };
  }, [setDialogContent, setIsSurrendered, setOpenOverDialog, socketRef]);

  const handleReturnClick = () => setSurrenderDialogOpen(true);

  const handleSurrender = () => {
    socketRef.current.emit('surrender');
  };

  return (
    <Box
      className='Game'
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
          right: { md: 12, lg: 16 },
          top: { md: 154, lg: 164 },
          bottom: 12,
          width: { md: 316, lg: 332 },
          zIndex: 109,
          pointerEvents: 'none',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
        }}
      >
        <Box
          sx={{
            pointerEvents: 'auto',
            maxHeight: '100%',
            display: 'flex',
            flexDirection: 'column',
            borderRadius: '12px',
            overflowY: 'auto',
            overflowX: 'hidden',
            scrollbarWidth: 'thin',
            boxShadow: '0 14px 46px rgba(0,0,0,.58)',
            border: '1px solid rgba(105, 145, 180, .22)',
            background: 'rgba(4, 10, 18, .92)',
            backdropFilter: 'blur(9px)',
          }}
        >
          <CommanderPanel />
        </Box>
      </Box>
    </Box>
  );
}
