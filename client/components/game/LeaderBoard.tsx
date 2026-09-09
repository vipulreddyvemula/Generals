import {
  Box,
  TableContainer,
  Table,
  TableCell,
  TableBody,
  TableHead,
  TableRow,
  Checkbox,
} from '@mui/material';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTranslation } from 'next-i18next';
import React, { useState, useEffect } from 'react';
import StarIcon from '@mui/icons-material/Star';
import { Player, LeaderBoardTable, UserData } from '@/lib/types';
import { ColorArr, MaxTeamNum, WarringStates } from '@/lib/constants';

interface LeaderBoardProps {
  players: Player[];
  leaderBoardTable: LeaderBoardTable | null;
  checkedPlayers?: UserData[];
  setCheckedPlayers?: (value: UserData[]) => void;
  warringStatesMode?: boolean;
}

type LeaderBoardData = {
  color: number;
  username: string | null;
  armyCount: number;
  landsCount: number;
}[];

export default function LeaderBoard(props: LeaderBoardProps) {
  const {
    players,
    leaderBoardTable,
    checkedPlayers,
    setCheckedPlayers,
    warringStatesMode = false,
  } = props;
  const [gameDockExpand, setGameDockExpand] = useState(true);
  const { t } = useTranslation();

  if (!leaderBoardTable) return null;

  const fetchUsernameByColor = function (color: number) {
    let res = players.filter((player) => player.color === color);
    if (res.length) return res[0].username;
    else return null;
  };

  let teams = new Array(MaxTeamNum + 1);
  leaderBoardTable.forEach((row) => {
    if (!teams[row[1]])
      teams[row[1]] = {
        id: row[1],
        armyCount: 0,
        landsCount: 0,
        players: [],
      };
    teams[row[1]].armyCount += row[2];
    teams[row[1]].landsCount += row[3];
    teams[row[1]].players.push({
      color: row[0],
      username: fetchUsernameByColor(row[0]),
      armyCount: row[2],
      landsCount: row[3],
    });
  });
  teams = teams
    .sort((a, b) => b.armyCount - a.armyCount || b.landsCount - a.landsCount)
    .map((x) => {
      return {
        ...x,
        players: x.players.sort(
          (a: any, b: any) =>
            b.armyCount - a.armyCount || b.landsCount - a.landsCount
        ),
      };
    });

  const isFFA = teams.every((t: any) => t.players.length === 1);

  return (
    <Box>
      <TableContainer>
        <Table
          className='menu-container'
          sx={{
            position: 'absolute',
            right: '0px',
            top: '0px',
            width: 'min-content',
            zIndex: '110',
            backgroundColor: 'white',
            borderCollapse: 'collapse',
            '& .MuiTableCell-root': {
              border: '2px solid #222 !important',
              paddingY: '4px',
              paddingX: '8px',
              color: 'black',
              fontWeight: 'bold',
              fontFamily: 'sans-serif',
              fontSize: '14px',
              lineHeight: '1.2',
            },
          }}
        >
          <TableHead>
            <TableRow
              sx={{ backgroundColor: 'white', whiteSpace: 'nowrap' }}
              onClick={() => {
                setGameDockExpand(!gameDockExpand);
              }}
            >
              <TableCell align='center' sx={{ display: warringStatesMode ? '' : 'none' }}>
                {t('country')}
              </TableCell>
              <TableCell align='center' sx={{ display: gameDockExpand && checkedPlayers && setCheckedPlayers ? '' : 'none' }}>
                {t('view')}
              </TableCell>
              <TableCell align='center' sx={{ minWidth: '40px' }}>
                <StarIcon sx={{ color: '#ffd700', fontSize: '18px', verticalAlign: 'middle' }} />
              </TableCell>
              <TableCell align='center' sx={{ display: gameDockExpand ? '' : 'none', minWidth: '150px' }}>
                Player
              </TableCell>
              <TableCell align='center' sx={{ display: gameDockExpand ? 'none' : '', padding: '1px' }}></TableCell>
              <TableCell align='center'>Army</TableCell>
              <TableCell align='center'>Land</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {teams.map((team, index) => (
              <React.Fragment key={team.id}>
                {!isFFA && (
                  <TableRow>
                    <TableCell
                      sx={{
                        display:
                          gameDockExpand && checkedPlayers && setCheckedPlayers
                            ? ''
                            : 'none',
                      }}
                    >
                      <Checkbox
                        defaultChecked={false}
                        sx={{
                          width: '1.5rem',
                          height: '1.5rem',
                        }}
                        onChange={(event: any) => {
                          if (!checkedPlayers || !setCheckedPlayers) return;
                          if (event.target.checked) {
                            let newCheckedPlayers = [
                              ...checkedPlayers,
                              ...team.players.map((x: any) => {
                                return {
                                  team: team.id,
                                  username: x.username,
                                  color: x.color,
                                } as UserData;
                              }),
                            ];
                            console.log(newCheckedPlayers);
                            setCheckedPlayers(newCheckedPlayers);
                          } else {
                            setCheckedPlayers(
                              checkedPlayers.filter((p) => p.team !== team.id)
                            );
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell align='center' sx={{ display: gameDockExpand ? '' : 'none', backgroundColor: '#222', color: 'white' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                        <StarIcon sx={{ color: '#ffd700', fontSize: '18px' }} />
                        0
                      </Box>
                    </TableCell>
                    <TableCell
                      sx={{
                        display: gameDockExpand ? '' : 'none',
                        backgroundColor: '#555',
                        color: 'white !important'
                      }}
                      align='center'
                      onClick={() => {
                        setGameDockExpand(!gameDockExpand);
                      }}
                    >
                      {'TEAM ' + team.id}
                    </TableCell>
                    <TableCell
                      sx={{
                        display: gameDockExpand ? 'none' : '',
                        backgroundColor: '#555',
                        color: 'white !important'
                      }}
                      onClick={() => {
                        setGameDockExpand(!gameDockExpand);
                      }}
                    >
                      {'T' + team.id}
                    </TableCell>
                    <TableCell
                      align='center'
                      sx={{ backgroundColor: 'white', color: 'black' }}
                      onClick={() => {
                        setGameDockExpand(!gameDockExpand);
                      }}
                    >
                      {team.armyCount}
                    </TableCell>
                    <TableCell
                      align='center'
                      sx={{ backgroundColor: 'white', color: 'black' }}
                      onClick={() => {
                        setGameDockExpand(!gameDockExpand);
                      }}
                    >
                      {team.landsCount}
                    </TableCell>
                  </TableRow>
                )}

                {team.players.map((player: any, j: number) => (
                  <TableRow key={index + '-' + (j + 1)}>
                    <TableCell
                      sx={{
                        display:
                          gameDockExpand && checkedPlayers && setCheckedPlayers
                            ? ''
                            : 'none',
                      }}
                    ></TableCell>
                    <TableCell align='center' sx={{ display: gameDockExpand ? '' : 'none', backgroundColor: '#222', color: 'white' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                        <StarIcon sx={{ color: '#ffd700', fontSize: '18px' }} />
                        0
                      </Box>
                    </TableCell>
                    <TableCell
                      align='center'
                      sx={{
                        display: gameDockExpand ? '' : 'none',
                        backgroundColor: ColorArr[player.color],
                        color: 'white !important',
                      }}
                      onClick={() => {
                        setGameDockExpand(!gameDockExpand);
                      }}
                    >
                      {player.username}
                    </TableCell>
                    <TableCell
                      sx={{
                        display: gameDockExpand ? 'none' : '',
                        padding: '3px',
                        backgroundColor: ColorArr[player.color],
                      }}
                      onClick={() => {
                        setGameDockExpand(!gameDockExpand);
                      }}
                    ></TableCell>
                    <TableCell
                      align='center'
                      sx={{ backgroundColor: 'white', color: 'black' }}
                      onClick={() => {
                        setGameDockExpand(!gameDockExpand);
                      }}
                    >
                      {player.armyCount}
                    </TableCell>
                    <TableCell
                      align='center'
                      sx={{ backgroundColor: 'white', color: 'black' }}
                      onClick={() => {
                        setGameDockExpand(!gameDockExpand);
                      }}
                    >
                      {player.landsCount}
                    </TableCell>
                  </TableRow>
                ))}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
