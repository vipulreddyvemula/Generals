import React, { useEffect, useState } from 'react';
import SurrenderDialog from './SurrenderDialog';
import GameMap from './GameMap';
import LeaderBoard from './LeaderBoard';
import GameTopBar from './GameTopBar';
import OverDialog from './OverDialog';
import CommanderPanel from './CommanderPanel';
import InGameTutorial from './InGameTutorial';
import { useGame, useGameDispatch } from '@/context/GameContext';

export default function Game() {
  const { room, socketRef, leaderBoardData, myPlayerId } = useGame();
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
    <main className='generals-root g-game-screen'>
      <GameTopBar onSurrender={handleReturnClick} />
      <div className='g-game-layout'>
        <aside className='g-game-left'>
          <LeaderBoard
            leaderBoardTable={leaderBoardData}
            players={room.players}
            warringStatesMode={room.warringStatesMode}
            matchHud
            myPlayerId={myPlayerId}
          />
        </aside>
        <section
          className='g-game-battlefield'
          aria-label='Game battlefield'
          data-tutorial='battlefield'
        >
          <GameMap />
          <InGameTutorial />
        </section>
        <aside className='g-game-right'>
          <CommanderPanel />
        </aside>
      </div>
      <SurrenderDialog
        isOpen={isSurrenderDialogOpen}
        setOpen={setSurrenderDialogOpen}
        handleSurrender={handleSurrender}
      />
      <OverDialog />
    </main>
  );
}
