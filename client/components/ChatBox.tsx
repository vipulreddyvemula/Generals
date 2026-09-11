import React, { useEffect, useRef, useState } from 'react';
import {
  Badge,
  Box,
  Divider,
  IconButton,
  InputBase,
  Paper,
  Typography,
} from '@mui/material';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { useTranslation } from 'next-i18next';
import { Socket } from 'socket.io-client';
import { Message } from '@/lib/types';
import { ColorArr } from '@/lib/constants';

function ChatMessage({ message }: { message: Message }) {
  return (
    <Typography
      component='div'
      sx={{
        fontSize: 11,
        lineHeight: 1.45,
        color: 'rgba(238,246,255,.82)',
        overflowWrap: 'anywhere',
      }}
    >
      <Box
        component='span'
        sx={{
          color: message.player ? ColorArr[message.player.color] : '#89a3bc',
          fontWeight: 800,
        }}
      >
        {message.player?.username || 'SYSTEM'}
      </Box>{' '}
      {message.content}
      {message.target && (
        <Box component='span' sx={{ color: ColorArr[message.target.color] }}>
          {' '}
          {message.target.username}
        </Box>
      )}
    </Typography>
  );
}

interface ChatBoxProps {
  socket: Socket | null;
  messages: Message[];
  compact?: boolean;
}

export default React.memo(function ChatBox({
  socket,
  messages,
  compact = false,
}: ChatBoxProps) {
  const [open, setOpen] = useState(!compact);
  const [inputValue, setInputValue] = useState('');
  const [lastReadCount, setLastReadCount] = useState(messages.length);
  const inputRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  useEffect(() => setOpen(!compact), [compact]);
  useEffect(() => {
    if (open) {
      setLastReadCount(messages.length);
      endRef.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [messages.length, open]);

  useEffect(() => {
    if (!compact) return;
    const focusChat = (event: KeyboardEvent) => {
      if (
        event.key !== 'Enter' ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      )
        return;
      const target = event.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;
      event.preventDefault();
      setOpen(true);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    };
    window.addEventListener('keydown', focusChat);
    return () => window.removeEventListener('keydown', focusChat);
  }, [compact]);

  const sendMessage = () => {
    const content = inputValue.trim();
    if (!content || !socket) return;
    socket.emit('player_message', content);
    setInputValue('');
  };

  const unread = open ? 0 : Math.max(0, messages.length - lastReadCount);

  if (compact && !open) {
    return (
      <Badge
        badgeContent={unread}
        color='error'
        sx={{ position: 'fixed', left: 16, bottom: 16, zIndex: 1200 }}
      >
        <IconButton
          aria-label='Open chat'
          onClick={() => setOpen(true)}
          sx={{
            width: 44,
            height: 44,
            color: '#dff7ff',
            bgcolor: 'rgba(7,18,30,.92)',
            border: '1px solid rgba(81,217,255,.38)',
            boxShadow: '0 8px 24px rgba(0,0,0,.45)',
            '&:hover': {
              bgcolor: 'rgba(15,37,55,.98)',
              borderColor: '#51d9ff',
            },
          }}
        >
          <ChatBubbleOutlineRoundedIcon fontSize='small' />
        </IconButton>
      </Badge>
    );
  }

  return (
    <Paper
      elevation={0}
      sx={{
        position: 'fixed',
        left: compact ? 16 : 0,
        bottom: compact ? 16 : 0,
        zIndex: 1200,
        width: compact ? 300 : 350,
        height: compact ? 270 : '40vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        borderRadius: compact ? '12px' : '0 24px 0 0',
        bgcolor: compact ? 'rgba(7,16,28,.96)' : '#212936',
        border: compact ? '1px solid rgba(81,217,255,.24)' : 'none',
        boxShadow: '0 12px 38px rgba(0,0,0,.55)',
        backdropFilter: 'blur(10px)',
      }}
    >
      <Box
        sx={{
          height: 36,
          px: 1.25,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255,255,255,.07)',
        }}
      >
        <Typography
          sx={{
            fontSize: 9,
            letterSpacing: 1.6,
            fontWeight: 900,
            color: '#8ceaff',
          }}
        >
          SQUAD COMMS
        </Typography>
        {compact && (
          <IconButton
            aria-label='Close chat'
            onClick={() => setOpen(false)}
            size='small'
            sx={{ color: 'rgba(235,245,255,.55)' }}
          >
            <CloseRoundedIcon sx={{ fontSize: 17 }} />
          </IconButton>
        )}
      </Box>
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          px: 1.25,
          py: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 0.55,
        }}
      >
        {messages.length === 0 && (
          <Typography
            sx={{ m: 'auto', fontSize: 10, color: 'rgba(235,245,255,.35)' }}
          >
            No transmissions yet.
          </Typography>
        )}
        {messages.map((message, index) => (
          <ChatMessage
            key={`${message.turn || 0}-${index}`}
            message={message}
          />
        ))}
        <div ref={endRef} />
      </Box>
      {socket && (
        <>
          <Divider sx={{ borderColor: 'rgba(255,255,255,.08)' }} />
          <InputBase
            inputRef={inputRef}
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') sendMessage();
            }}
            placeholder={t('type-a-message')}
            inputProps={{ maxLength: 300, 'aria-label': 'Chat message' }}
            sx={{
              height: 38,
              px: 1.25,
              color: '#fff',
              fontSize: 11,
              bgcolor: 'rgba(0,0,0,.16)',
            }}
          />
        </>
      )}
    </Paper>
  );
});
