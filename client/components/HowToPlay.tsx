import React from 'react';
import { useTranslation } from 'next-i18next';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  Box,
} from '@mui/material';
import Image from 'next/image';
import { TileType, TileType2Image } from '@/lib/types';

interface HowToPlayProps {
  show: boolean;
  toggleShow: () => void;
}

const HowToPlay: React.FC<HowToPlayProps> = ({ show, toggleShow }) => {
  const { t } = useTranslation('common');

  const tableData = [
    { label: t('howToPlay.move'), value: t('howToPlay.wsad') },
    { label: t('howToPlay.openChat'), value: t('howToPlay.enter') },
    { label: t('howToPlay.surrender'), value: 'Esc' },
    { label: t('howToPlay.selectGeneral'), value: 'G' },
    { label: t('howToPlay.centerGeneral'), value: 'H' },
    { label: t('howToPlay.centerMap'), value: 'C' },
    { label: t('howToPlay.toggle50'), value: t('howToPlay.how-to-toggle-50') },
    { label: t('howToPlay.undoMove'), value: 'E' },
    { label: t('howToPlay.clearQueuedMoves'), value: 'Q' },
    { label: t('howToPlay.setZoom'), value: '1 / 2 / 3' },
    { label: t('howToPlay.zoomInOut'), value: t('howToPlay.mouse-wheel') },
  ];

  return (
    <Dialog open={show} onClose={toggleShow} maxWidth="md" fullWidth>
      <DialogTitle>{t('howToPlay.title')}</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 3, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Typography variant='body1'>
            <strong>{t('howToPlay.goalLabel')}:</strong> {t('howToPlay.goal')}
            <Image
              src={TileType2Image[TileType.King]}
              alt='king'
              width='18'
              height='18'
              style={{
                backgroundColor: 'white',
                verticalAlign: 'middle',
                marginLeft: '6px',
              }}
            />
          </Typography>
          <Typography variant='body1'>
            <strong>{t('howToPlay.moveLabel')}:</strong> {t('howToPlay.moveText')}
          </Typography>
          <Typography variant='body1'>
            <strong>{t('howToPlay.growLabel')}:</strong> {t('howToPlay.grow')}
            <Image
              src={TileType2Image[TileType.City]}
              alt='city'
              width='18'
              height='18'
              style={{
                backgroundColor: 'white',
                verticalAlign: 'middle',
                marginLeft: '6px',
              }}
            />
          </Typography>
          <Typography variant='body1'>
            <strong>{t('howToPlay.commanderLabel')}:</strong> {t('howToPlay.commander')}
          </Typography>
          <Typography variant='body1'>
            <strong>{t('howToPlay.winLabel')}:</strong> {t('howToPlay.win')}
          </Typography>
          <Typography variant='body1' sx={{ fontStyle: 'italic', color: 'text.secondary', mt: 0.5 }}>
            <strong>{t('howToPlay.tipLabel')}:</strong> {t('howToPlay.tip')}
          </Typography>
        </Box>

        <Typography variant='h6' sx={{ mb: 1, mt: 2 }}>
          {t('howToPlay.shortcut')}
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell><strong>{t('howToPlay.shortcut')}</strong></TableCell>
              <TableCell><strong>{t('howToPlay.key')}</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tableData.map((row, index) => (
              <TableRow key={index}>
                <TableCell>{row.label}</TableCell>
                <TableCell>{row.value}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  );
};

export default HowToPlay;
