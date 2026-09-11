import {
  LeaderBoardTable,
  MapData,
  MapQueueData,
  Position,
  Room,
  RoomUiStatus,
  SelectedMapTileInfo,
  SnackState,
  TileProp,
  TileType,
  UserData,
  initGameInfo,
  AbilityType
} from '@/lib/types';
import React, {
  MutableRefObject,
  createContext,
  useCallback,
  useContext,
  useReducer,
  useRef,
  useState,
} from 'react';

import {
  mapDataReducer,
  mapQueueDataReducer,
  roomReducer,
  snackStateReducer,
} from './GameReducer';
import usePossibleNextMapPositions from '@/lib/use-possible-next-map-positions';

// userData, game_status, replay_link
type DialogContentData = [[UserData | null], string, string | null];

interface GameContext {
  room: Room;
  socketRef: any;
  mapData: MapData;
  mapQueueData: MapQueueData;
  roomUiStatus: RoomUiStatus;
  myPlayerId: string;
  myUserName: string;
  isSurrendered: boolean;
  team: number;
  turnsCount: number;
  leaderBoardData: LeaderBoardTable | null;
  dialogContent: DialogContentData;
  openOverDialog: boolean;
  snackState: SnackState;
  attackQueueRef: any; // AttackQueue
  selectedMapTileInfo: SelectedMapTileInfo;
  initGameInfo: initGameInfo | null;
  activeAbility: AbilityType | null;
}

interface GameDispatch {
  roomDispatch: React.Dispatch<any>;
  mapDataDispatch: React.Dispatch<any>;
  mapQueueDataDispatch: React.Dispatch<any>;
  setRoomUiStatus: React.Dispatch<React.SetStateAction<RoomUiStatus>>;
  setMyPlayerId: React.Dispatch<React.SetStateAction<string>>;
  setMyUserName: React.Dispatch<React.SetStateAction<string>>;
  setIsSurrendered: React.Dispatch<React.SetStateAction<boolean>>;
  setTeam: React.Dispatch<React.SetStateAction<number>>;
  setTurnsCount: React.Dispatch<React.SetStateAction<number>>;
  setLeaderBoardData: React.Dispatch<any>;
  setDialogContent: React.Dispatch<React.SetStateAction<DialogContentData>>;
  setOpenOverDialog: React.Dispatch<React.SetStateAction<boolean>>;
  snackStateDispatch: React.Dispatch<any>;
  setSelectedMapTileInfo: React.Dispatch<
    React.SetStateAction<SelectedMapTileInfo>
  >;
  setInitGameInfo: React.Dispatch<any>;
  setActiveAbility: React.Dispatch<React.SetStateAction<AbilityType | null>>;
  attackUp: (info: SelectedMapTileInfo) => void
  attackDown: (info: SelectedMapTileInfo) => void
  attackLeft: (info: SelectedMapTileInfo) => void
  attackRight: (info: SelectedMapTileInfo) => void
  handlePositionChange: (selectPos: SelectedMapTileInfo, newPoint: Position, className: string) => void
  testIfNextPossibleMove: (tileType: TileType, x: number, y: number) => boolean
  handleClick: (tile: TileProp, x: number, y: number, myPlayerIndex: number) => void
  halfArmy: (touchHalf: MutableRefObject<boolean>) => void
  clearQueue: () => void
  popQueue: () => void
  selectGeneral: () => void
}

const GameContext = createContext<GameContext | undefined>(undefined);
const GameDispatch = createContext<GameDispatch | undefined>(undefined);

interface GameProviderProp {
  children: React.ReactNode;
}

const GameProvider: React.FC<GameProviderProp> = ({ children }) => {
  const [room, roomDispatch] = useReducer(roomReducer, new Room(''));
  const [mapData, mapDataDispatch] = useReducer(mapDataReducer, [[]]);
  const [mapQueueData, mapQueueDataDispatch] = useReducer(
    mapQueueDataReducer,
    []
  );
  const socketRef = useRef<any>();
  const attackQueueRef = useRef<any>();
  const syncSelectedTileRef = useRef<SelectedMapTileInfo | null>(null);
  const [roomUiStatus, setRoomUiStatus] = useState(RoomUiStatus.gameSetting);
  const [snackState, snackStateDispatch] = useReducer(snackStateReducer, {
    open: false,
    title: '',
    message: '',
    status: 'error',
    duration: 3000,
  });
  const [myPlayerId, setMyPlayerId] = useState('');
  const [myUserName, setMyUserName] = useState('');
  const [isSurrendered, setIsSurrendered] = useState<boolean>(false);
  const [team, setTeam] = useState<number>(0);
  const [initGameInfo, setInitGameInfo] = useState<initGameInfo | null>(null);
  const [turnsCount, setTurnsCount] = useState(0);
  const [leaderBoardData, setLeaderBoardData] = useState(null);
  const [dialogContent, setDialogContent] = useState<DialogContentData>([
    [null],
    '',
    null,
  ]);
  const [openOverDialog, setOpenOverDialog] = useState(false);
  const [selectedMapTileInfo, setSelectedMapTileInfo] =
    useState<SelectedMapTileInfo>({
      x: -1,
      y: -1,
      half: false,
      unitsCount: 0,
    });
  const [activeAbility, setActiveAbility] = useState<AbilityType | null>(null);

  const halfArmy = useCallback((touchHalf: MutableRefObject<boolean>) => {
    if (selectedMapTileInfo) {
      let selectPos = selectedMapTileInfo;
      if (selectPos.x === -1 || selectPos.y === -1) return;
      touchHalf.current = !touchHalf.current; // todo: potential bug
      const newInfo = {
        x: selectPos.x,
        y: selectPos.y,
        half: touchHalf.current,
        unitsCount: 0,
      };
      syncSelectedTileRef.current = newInfo;
      setSelectedMapTileInfo(newInfo);
      mapQueueDataDispatch({
        type: 'change',
        x: selectPos.x,
        y: selectPos.y,
        className: '',
        half: touchHalf.current,
      });
    }
  }, [mapQueueDataDispatch, selectedMapTileInfo, setSelectedMapTileInfo]);

  const selectGeneral = useCallback(() => {
    if (initGameInfo && selectedMapTileInfo) {
      const { king } = initGameInfo;
      const newInfo = { ...selectedMapTileInfo, x: king.x, y: king.y };
      syncSelectedTileRef.current = newInfo;
      setSelectedMapTileInfo(newInfo);
    }
  }, [initGameInfo, selectedMapTileInfo, setSelectedMapTileInfo]);

  const popQueue = useCallback(() => {
    if (selectedMapTileInfo) {
      let route = attackQueueRef.current.pop_back();
      if (route) {
        const newInfo = {
          ...selectedMapTileInfo,
          x: route.from.x,
          y: route.from.y,
          //  todo: fix half/unitsCount logic
        };
        syncSelectedTileRef.current = newInfo;
        setSelectedMapTileInfo(newInfo);
      }
    }
  }, [attackQueueRef, selectedMapTileInfo, setSelectedMapTileInfo]);
  const clearQueue = useCallback(() => {
    if (selectedMapTileInfo) {
      let route = attackQueueRef.current.front();
      if (route) {
        attackQueueRef.current.clear();
        const newInfo = {
          ...selectedMapTileInfo,
          x: route.from.x,
          y: route.from.y,
        };
        syncSelectedTileRef.current = newInfo;
        setSelectedMapTileInfo(newInfo);
      }
    }
  }, [attackQueueRef, selectedMapTileInfo, setSelectedMapTileInfo]);

  const possibleNextMapPositions = usePossibleNextMapPositions({
    width: room.map ? room.map.width : 0,
    height: room.map ? room.map.height : 0,
    selectedMapTileInfo: selectedMapTileInfo ? { x: selectedMapTileInfo.x, y: selectedMapTileInfo.y } : undefined,
  });

  const testIfNextPossibleMoveInternal = useCallback((tileType: TileType, x: number, y: number, basePos: SelectedMapTileInfo) => {
    if (tileType === TileType.Mountain) return false;
    if (!basePos || basePos.x === -1 || basePos.y === -1) return false;
    
    return (
      (basePos.x === x && basePos.y - 1 === y) ||
      (basePos.x === x && basePos.y + 1 === y) ||
      (basePos.x - 1 === x && basePos.y === y) ||
      (basePos.x + 1 === x && basePos.y === y)
    );
  }, []);

  const testIfNextPossibleMove = useCallback((tileType: TileType, x: number, y: number) => {
    if (!selectedMapTileInfo) return false;
    return testIfNextPossibleMoveInternal(tileType, x, y, selectedMapTileInfo);
  }, [selectedMapTileInfo, testIfNextPossibleMoveInternal]);

  const withinMap = useCallback(
    (point: Position) => {
      if (!initGameInfo) return false;
      return (
        0 <= point.x &&
        point.x < initGameInfo.mapWidth &&
        0 <= point.y &&
        point.y < initGameInfo.mapHeight
      );
    },
    [initGameInfo]
  );

  const handlePositionChange = useCallback(
    (selectPos: SelectedMapTileInfo, newPoint: Position, className: string) => {
      if (withinMap(newPoint)) {
        attackQueueRef.current.insert({
          from: selectPos,
          to: newPoint,
          half: selectPos.half,
        });
        const newInfo = {
          // ...selectPos,
          x: newPoint.x,
          y: newPoint.y,
          half: false,
          unitsCount: 0,
        };
        syncSelectedTileRef.current = newInfo;
        setSelectedMapTileInfo(newInfo);
        mapQueueDataDispatch({
          type: 'change',
          x: selectPos.x,
          y: selectPos.y,
          className: className,
        });
      } else {
        console.log("new point not within map", newPoint)
      }
    },
    [
      withinMap,
      attackQueueRef,
      mapQueueDataDispatch,
      setSelectedMapTileInfo,
    ]
  );

  const handleClick = useCallback((tile: TileProp, x: number, y: number, myPlayerIndex: number) => {
    if (activeAbility) {
      socketRef.current.emit('activate_ability', activeAbility, { x, y });
      setActiveAbility(null);
      return;
    }
    const [tileType, color, unitsCount] = tile;
    const isOwned = myPlayerIndex !== -1 && room.players[myPlayerIndex] ? color === room.players[myPlayerIndex].color : false;

    const truePos = syncSelectedTileRef.current || selectedMapTileInfo;
    const isNextPossibleMove = testIfNextPossibleMoveInternal(tileType, x, y, truePos);
    let tileHalf = false;

    if (truePos.x === x && truePos.y === y) {
      tileHalf = truePos.half;
    } else if (mapQueueData.length !== 0 && mapQueueData[x][y].half) {
      tileHalf = true;
    } else {
      tileHalf = false;
    }


    const getPossibleMoveDirection = () => {
      if (isNextPossibleMove) {
        if (truePos.x - 1 === x && truePos.y === y) return 'up';
        if (truePos.x + 1 === x && truePos.y === y) return 'down';
        if (truePos.x === x && truePos.y - 1 === y) return 'left';
        if (truePos.x === x && truePos.y + 1 === y) return 'right';
      }
      return '';
    };
    const moveDirection = getPossibleMoveDirection();

    if (isNextPossibleMove) {
      handlePositionChange(truePos, { x, y }, `queue_${moveDirection}`);
    } else if (isOwned) {
      if (truePos.x === x && truePos.y === y) {
        console.log(
          'Clicked on the current tile, changing tile half state to',
          !tileHalf
        );
        const newInfo = {
          x,
          y,
          half: !tileHalf,
          unitsCount: unitsCount,
        };
        syncSelectedTileRef.current = newInfo;
        setSelectedMapTileInfo(newInfo);
      } else {
        const newInfo = { x, y, half: false, unitsCount: unitsCount };
        syncSelectedTileRef.current = newInfo;
        setSelectedMapTileInfo(newInfo);
      }
    } else {
      const newInfo = { x: -1, y: -1, half: false, unitsCount: 0 };
      syncSelectedTileRef.current = newInfo;
      setSelectedMapTileInfo(newInfo);
      mapQueueDataDispatch({
        type: 'change',
        x: x,
        y: y,
        className: '',
        half: false,
      });
    }
  }, [selectedMapTileInfo, mapQueueData, possibleNextMapPositions, handlePositionChange, activeAbility, setSelectedMapTileInfo, mapQueueDataDispatch]);

  const attackUp = useCallback((selectPos?: SelectedMapTileInfo) => {
    const truePos = syncSelectedTileRef.current || selectPos;
    if (truePos) {
      let newPoint = {
        x: truePos.x - 1,
        y: truePos.y,
      };
      handlePositionChange(truePos, newPoint, 'queue_up');
    }
  }, [handlePositionChange]);
  const attackDown = useCallback((selectPos?: SelectedMapTileInfo) => {
    const truePos = syncSelectedTileRef.current || selectPos;
    if (truePos) {
      let newPoint = {
        x: truePos.x + 1,
        y: truePos.y,
      };
      handlePositionChange(truePos, newPoint, 'queue_down');
    }
  }, [handlePositionChange]);
  const attackLeft = useCallback((selectPos?: SelectedMapTileInfo) => {
    const truePos = syncSelectedTileRef.current || selectPos;
    if (truePos) {
      let newPoint = {
        x: truePos.x,
        y: truePos.y - 1,
      };
      handlePositionChange(truePos, newPoint, 'queue_left');
    }
  }, [handlePositionChange]);
  const attackRight = useCallback((selectPos?: SelectedMapTileInfo) => {
    const truePos = syncSelectedTileRef.current || selectPos;
    if (truePos) {
      let newPoint = {
        x: truePos.x,
        y: truePos.y + 1,
      };
      handlePositionChange(truePos, newPoint, 'queue_right');
    }
  }, [handlePositionChange]);


  return (
    <GameContext.Provider
      value={{
        room,
        socketRef,
        mapData,
        mapQueueData,
        roomUiStatus,
        myPlayerId,
        myUserName,
        isSurrendered,
        team,
        turnsCount,
        leaderBoardData,
        dialogContent,
        openOverDialog,
        snackState,
        attackQueueRef,
        selectedMapTileInfo,
        initGameInfo,
        activeAbility
      }}
    >
      <GameDispatch.Provider
        value={{
          roomDispatch,
          mapDataDispatch,
          mapQueueDataDispatch,
          setRoomUiStatus,
          setMyPlayerId,
          setMyUserName,
          setIsSurrendered,
          setTeam,
          setTurnsCount,
          setLeaderBoardData,
          setDialogContent,
          setOpenOverDialog,
          snackStateDispatch,
          setSelectedMapTileInfo,
          setInitGameInfo,
          setActiveAbility,
          attackUp,
          attackDown,
          attackLeft,
          attackRight,
          handlePositionChange,
          testIfNextPossibleMove,
          handleClick,
          halfArmy,
          clearQueue,
          popQueue,
          selectGeneral
        }}
      >
        {children}
      </GameDispatch.Provider>
    </GameContext.Provider>
  );
};

const useGame = () => {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGameContext must be used within a GameProvider');
  }
  return context;
};

const useGameDispatch = () => {
  const context = useContext(GameDispatch);
  if (context === undefined) {
    throw new Error('useGameDispatch must be used within a GameProvider');
  }
  return context;
};

export { GameProvider, useGame, useGameDispatch };
