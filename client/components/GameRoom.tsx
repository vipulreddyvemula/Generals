import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/router';
import { io } from 'socket.io-client';
import { useTranslation } from 'next-i18next';
import ChatBox from '@/components/ChatBox';

import { Snackbar, Alert, AlertTitle } from '@mui/material';

import {
  Room,
  Message,
  UserData,
  MapDiffData,
  LeaderBoardTable,
  Route,
  Position,
  RoomUiStatus,
  initGameInfo,
} from '@/lib/types';
import Game from '@/components/game/Game';
import { useGame, useGameDispatch } from '@/context/GameContext';
import GameSetting from '@/components/GameSetting';
import GameLoading from '@/components/GameLoading';

function GamingRoom() {
  const [messages, setMessages] = useState<Message[]>([]);
  const myPlayerIdRef = useRef<string>(''); // fix useEffect don't get newest myPlayerId

  const router = useRouter();
  const roomId = router.query.roomId as string;

  const { t } = useTranslation();

  const {
    room,
    roomUiStatus,
    socketRef,
    myPlayerId,
    attackQueueRef,
    myUserName,
    snackState,
  } = useGame();

  const socketDisconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const {
    roomDispatch,
    mapDataDispatch,
    setRoomUiStatus,
    setMyPlayerId,
    setTurnsCount,
    setLeaderBoardData,
    setDialogContent,
    setOpenOverDialog,
    snackStateDispatch,
    mapQueueDataDispatch,
    setSelectedMapTileInfo,
    setInitGameInfo,
    setIsSurrendered,
    setTeam,
    setMyUserName,
  } = useGameDispatch();

  useEffect(() => {
    let tmp: string | null = localStorage.getItem('username');
    if (!tmp) {
      router.push('/player-details');
    } else {
      setMyUserName(tmp);
    }
  }, [setMyPlayerId, setMyUserName, router]);

  useEffect(() => {
    // Game Logic Init
    if (!roomId) return;
    const usernameFromStorage = localStorage.getItem('username') || myUserName;
    if (!usernameFromStorage) return;

    class AttackQueue {
      public items: Route[];
      public lastItem: Route | undefined;
      public allowAttackThisTurn: boolean;

      constructor() {
        this.items = new Array<Route>();
        this.lastItem = undefined;
        this.allowAttackThisTurn = false;
      }

      insert(item: Route): void {
        console.log('Item queued: ', item.to.x, item.to.y);
        this.items.push(item);
      }

      clearFromMap(route: Route): void {
        mapQueueDataDispatch({
          type: 'change',
          x: route.from.x,
          y: route.from.y,
          className: '',
        });
      }

      pop(): Route | undefined {
        let item = this.items.shift();
        if (this.lastItem) {
          this.clearFromMap(this.lastItem);
          this.lastItem = undefined;
        }
        this.lastItem = item;
        return item;
      }

      pop_back(): Route | undefined {
        let item = this.items.pop();
        if (item) {
          this.clearFromMap(item);
          return item;
        }
      }

      front(): Route {
        return this.items[0];
      }

      end(): Route {
        return this.items[this.items.length - 1];
      }

      isEmpty(): boolean {
        return this.items.length == 0;
      }

      size(): number {
        return this.items.length;
      }

      clear(): void {
        this.items.forEach((item) => {
          this.clearFromMap(item);
        });
        this.items.length = 0;
        this.clearLastItem();
      }

      clearLastItem(): void {
        if (this.lastItem) {
          this.clearFromMap(this.lastItem);
          this.lastItem = undefined;
        }
      }
    }

    attackQueueRef.current = new AttackQueue();

    const sessionStorageKey = `generals.player-session.${roomId}`;
    let savedSession: { playerId: string; reconnectToken: string } | null =
      null;
    try {
      const storedSession = localStorage.getItem(sessionStorageKey);
      if (storedSession) {
        const parsed = JSON.parse(storedSession);
        if (
          typeof parsed?.playerId === 'string' &&
          typeof parsed?.reconnectToken === 'string'
        ) {
          savedSession = parsed;
          setMyPlayerId(parsed.playerId);
          myPlayerIdRef.current = parsed.playerId;
        }
      }
    } catch {
      localStorage.removeItem(sessionStorageKey);
    }

    if (socketDisconnectTimerRef.current) {
      clearTimeout(socketDisconnectTimerRef.current);
      socketDisconnectTimerRef.current = null;
    }

    if (!socketRef.current) {
      socketRef.current = io(process.env.NEXT_PUBLIC_SERVER_API, {
        query: {
          roomId: roomId,
          username: usernameFromStorage,
        },
        auth: savedSession || {},
      });
    } else if (socketRef.current.disconnected) {
      socketRef.current.auth = savedSession || {};
      socketRef.current.connect();
    }
    let socket = socketRef.current;
    let duplicateRetryCount = 0;
    let duplicateRetryTimer: ReturnType<typeof setTimeout> | null = null;
    // set up socket event listeners
    socket.on('connect', () => {
      console.log(`socket client connect to server: ${socket.id}`);
      snackStateDispatch({ type: 'close' });
      socket.emit('get_room_info');
    });
    // get player id when first connect
    socket.on('set_player_id', (playerId: string) => {
      console.log(`set_player_id: ${playerId}`);
      setMyPlayerId(playerId);
      myPlayerIdRef.current = playerId;
    });
    socket.on(
      'player_session',
      (session: { playerId: string; reconnectToken: string }) => {
        duplicateRetryCount = 0;
        if (duplicateRetryTimer) clearTimeout(duplicateRetryTimer);
        duplicateRetryTimer = null;
        setMyPlayerId(session.playerId);
        myPlayerIdRef.current = session.playerId;
        socket.auth = session;
        localStorage.setItem(sessionStorageKey, JSON.stringify(session));
      }
    );
    socket.on('game_started', (initGameInfo: initGameInfo) => {
      console.log('Game started:', initGameInfo);
      const audio = new Audio('/audio/fresh_snap.mp3');
      // Autoplay may be denied until the player interacts with the page.
      void audio.play().catch(() => undefined);
      setInitGameInfo(initGameInfo);
      setIsSurrendered(false);
      setDialogContent([[null], '', null]);
      setOpenOverDialog(false);

      setSelectedMapTileInfo({
        x: initGameInfo.king.x,
        y: initGameInfo.king.y,
        half: false,
        unitsCount: 0,
      });

      mapDataDispatch({
        type: 'init',
        mapWidth: initGameInfo.mapWidth,
        mapHeight: initGameInfo.mapHeight,
      });

      mapQueueDataDispatch({
        type: 'init',
        mapWidth: initGameInfo.mapWidth,
        mapHeight: initGameInfo.mapHeight,
      });
    });
    socket.on('update_room', (room: Room) => {
      console.log('update_room');
      console.log(room);
      console.log(myPlayerIdRef.current);
      // if my player id  equal to room's one of player ,setSpectating from room player
      if (myPlayerIdRef.current && room.players) {
        let player = room.players.find(
          (player) => player.id === myPlayerIdRef.current
        );
        if (player) {
          setTeam(player.team);
          console.log('set team', player.team);
        }
      }
      roomDispatch({ type: 'update', payload: room });
    });

    socket.on('error', (title: string, message: string) => {
      snackStateDispatch({
        type: 'update',
        title: title,
        message: message,
        duration: 3000,
      });
    });

    socket.on('room_message', (player: UserData | null, content: string) => {
      setMessages((messages: any) => [
        ...messages,
        new Message(player, content),
      ]);
    });
    socket.on('captured', (player1: UserData, player2: UserData) => {
      setMessages((messages: any) => [
        ...messages,
        new Message(player1, t('captured'), player2),
      ]);
    });
    socket.on('host_modification', (player1: UserData, player2: UserData) => {
      setMessages((messages: any) => [
        ...messages,
        new Message(player1, t('transfer-host-to'), player2),
      ]);
    });
    socket.on('game_over', (capturedBy: UserData) => {
      console.log(`game_over: ${capturedBy.username}`);
      setOpenOverDialog(true);
      setRoomUiStatus(RoomUiStatus.gameOverConfirm);
      setDialogContent([[capturedBy], 'game_over', null]);
    });
    socket.on('game_ended', (winner: [UserData], replayLink: string) => {
      console.log(`game_ended: ${winner.map((x) => x.username)} ${replayLink}`);
      setDialogContent([winner, 'game_ended', replayLink]);
      setOpenOverDialog(true);
      setRoomUiStatus(RoomUiStatus.gameOverConfirm);
    });

    socket.on(
      'attack_success',
      (from: Position, to: Position, turn: number) => {
        console.log('attach success: ', from, to, turn);
      }
    );

    socket.on(
      'game_update',
      (
        mapDiff: MapDiffData,
        turnsCount: number,
        leaderBoardData: LeaderBoardTable
      ) => {
        // console.log(`game_update: ${turnsCount}`, new Date().toISOString());
        console.log(`game_update: ${turnsCount}`);

        attackQueueRef.current.allowAttackThisTurn = true;
        setRoomUiStatus(RoomUiStatus.gameRealStarted);
        mapDataDispatch({ type: 'update', mapDiff });
        setTurnsCount(turnsCount);
        setLeaderBoardData(leaderBoardData);

        if (!attackQueueRef.current.isEmpty()) {
          let item = attackQueueRef.current.pop();
          socket.emit('attack', item.from, item.to, item.half);
          attackQueueRef.current.allowAttackThisTurn = false;
          console.log(
            `emit attack: `,
            item.from,
            item.to,
            item.half,
            turnsCount
          );
        } else if (attackQueueRef.current.lastItem) {
          attackQueueRef.current.clearLastItem();
        }
      }
    );

    socket.on(
      'attack_failure',
      (from: Position, to: Position, message: string) => {
        console.log('attack_failure: ', from, to, message);
        attackQueueRef.current.clearLastItem();
        while (!attackQueueRef.current.isEmpty()) {
          let route = attackQueueRef.current.front();
          if (route.from.x === to.x && route.from.y === to.y) {
            attackQueueRef.current.pop();
            to = route.to;
          } else {
            break;
          }
        }
      }
    );

    socket.on('reject_join', (message: string) => {
      if (
        message.includes('already active on another connection') &&
        savedSession &&
        duplicateRetryCount < 3
      ) {
        duplicateRetryCount += 1;
        snackStateDispatch({
          type: 'update',
          title: 'Restoring session',
          status: 'info',
          message: 'Waiting for the previous connection to close…',
          duration: null,
        });
        duplicateRetryTimer = setTimeout(() => {
          duplicateRetryTimer = null;
          socket.connect();
        }, 300 * duplicateRetryCount);
        return;
      }
      if (message.startsWith('Session authentication failed')) {
        localStorage.removeItem(sessionStorageKey);
        socket.auth = {};
      }
      void router.replace({
        pathname: '/play',
        query: { joinError: message || 'Could not join this room.' },
      });
    });

    socket.on('connect_error', (error: Error) => {
      console.log('\nConnection Failed: ' + error);
      snackStateDispatch({
        type: 'update',
        title: 'Connect Error',
        status: 'error',
        message: 'Connection unavailable. Retrying…',
        duration: null,
      });
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from server.');
      if (duplicateRetryTimer) return;

      snackStateDispatch({
        type: 'update',
        title: 'Reconnecting...',
        status: 'error',
        message: 'Disconnected from the server',
        duration: null,
      });
    });

    return () => {
      if (duplicateRetryTimer) clearTimeout(duplicateRetryTimer);
      socket.removeAllListeners();
      socketDisconnectTimerRef.current = setTimeout(() => {
        socket.disconnect();
      }, 500);
    };
  }, [roomId]);

  useEffect(() => {
    if (room.gameStarted && roomUiStatus === RoomUiStatus.gameSetting) {
      setRoomUiStatus(RoomUiStatus.loading);
    }
  }, [room, roomUiStatus, setRoomUiStatus]);

  return (
    <div className='generals-room-root'>
      <Snackbar
        open={snackState.open}
        autoHideDuration={snackState.duration}
        onClose={() => {
        snackStateDispatch({ type: 'close' });
        }}
      >
        <Alert severity={snackState.status} sx={{ width: '100%' }}>
          <AlertTitle>{snackState.title}</AlertTitle>
          {snackState.message}
        </Alert>
      </Snackbar>
      {roomUiStatus === RoomUiStatus.gameSetting && (
        room.id && myPlayerId ? (
          <GameSetting chat={<ChatBox socket={socketRef.current} messages={messages} embedded />} />
        ) : <GameLoading />
      )}
      {roomUiStatus === RoomUiStatus.loading && (
        <div className='center-layout'>
          <GameLoading />
        </div>
      )}
      {(roomUiStatus === RoomUiStatus.gameRealStarted ||
        roomUiStatus === RoomUiStatus.gameOverConfirm) && <Game />}
      {(roomUiStatus === RoomUiStatus.gameRealStarted ||
        roomUiStatus === RoomUiStatus.gameOverConfirm) &&
        <ChatBox socket={socketRef.current} messages={messages} compact />}
    </div>
  );
}

export default GamingRoom;
