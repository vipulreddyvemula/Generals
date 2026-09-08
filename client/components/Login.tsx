import { Box, Typography, Button, TextField, keyframes } from '@mui/material';
import { useState } from 'react';

const float = keyframes`
  0%   { transform: translateY(0px);  }
  50%  { transform: translateY(-8px); }
  100% { transform: translateY(0px);  }
`;

const borderPulse = keyframes`
  0%   { border-color: rgba(0,212,255,0.3); }
  50%  { border-color: rgba(0,212,255,0.8); }
  100% { border-color: rgba(0,212,255,0.3); }
`;

interface LoginProps {
  username: string;
  handlePlayClick: (username: string) => void;
}

const Login: React.FC<LoginProps> = ({ handlePlayClick }) => {
  const [inputName, setInputName] = useState('');

  const handleInputKeyDown = (event: any) => {
    if (event.key === 'Enter' && inputName.trim()) {
      handlePlayClick(inputName.trim());
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'radial-gradient(ellipse at center, #0a1628 0%, #050a14 70%)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Decorative background grid */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(0,212,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,212,255,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
          pointerEvents: 'none',
        }}
      />

      {/* Commander icon */}
      <Typography
        sx={{
          fontSize: '4rem',
          mb: 1,
          animation: `${float} 4s ease-in-out infinite`,
          filter: 'drop-shadow(0 0 20px rgba(0,212,255,0.6))',
        }}
      >
        ⚔
      </Typography>

      {/* Title */}
      <Typography
        variant="h4"
        sx={{
          fontWeight: 800,
          letterSpacing: 6,
          mb: 0.5,
          background: 'linear-gradient(90deg, #00d4ff, #7a00ff)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          textTransform: 'uppercase',
        }}
      >
        Commander Mode
      </Typography>
      <Typography
        sx={{
          color: 'rgba(255,255,255,0.35)',
          fontSize: '0.8rem',
          letterSpacing: 3,
          mb: 4,
          textTransform: 'uppercase',
        }}
      >
        Solve. Command. Conquer.
      </Typography>

      {/* Login card */}
      <Box
        sx={{
          width: { xs: '88vw', sm: '420px' },
          p: 4,
          background: 'rgba(10,20,40,0.8)',
          border: '1px solid rgba(0,212,255,0.3)',
          borderRadius: 3,
          backdropFilter: 'blur(20px)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(0,212,255,0.05)',
          animation: `${borderPulse} 3s ease-in-out infinite`,
        }}
      >
        <Typography
          sx={{
            color: 'rgba(255,255,255,0.5)',
            fontSize: '0.7rem',
            letterSpacing: 2.5,
            textTransform: 'uppercase',
            mb: 1.5,
          }}
        >
          Enter Commander Name
        </Typography>

        <TextField
          fullWidth
          autoFocus
          variant="outlined"
          placeholder="Your callsign..."
          value={inputName}
          onChange={e => setInputName(e.target.value)}
          onKeyDown={handleInputKeyDown}
          sx={{
            mb: 2,
            '& .MuiInputBase-input': {
              color: 'white',
              fontSize: '1rem',
              fontWeight: 600,
              letterSpacing: 1,
            },
            '& .MuiOutlinedInput-root': {
              '& fieldset': { borderColor: 'rgba(0,212,255,0.3)' },
              '&:hover fieldset': { borderColor: '#00d4ff' },
              '&.Mui-focused fieldset': { borderColor: '#00d4ff' },
            },
            '& input::placeholder': { color: 'rgba(255,255,255,0.25)' },
          }}
        />

        <Button
          fullWidth
          variant="contained"
          disabled={!inputName.trim()}
          onClick={() => handlePlayClick(inputName.trim())}
          sx={{
            background: 'linear-gradient(45deg, #00d4ff, #0055ff)',
            color: 'white',
            fontWeight: 700,
            fontSize: '0.9rem',
            letterSpacing: 2,
            py: 1.4,
            borderRadius: 2,
            textTransform: 'uppercase',
            boxShadow: '0 4px 20px rgba(0,212,255,0.3)',
            '&:hover': {
              background: 'linear-gradient(45deg, #0055ff, #00d4ff)',
              boxShadow: '0 6px 25px rgba(0,212,255,0.5)',
            },
            '&.Mui-disabled': {
              background: 'rgba(255,255,255,0.05)',
              color: 'rgba(255,255,255,0.2)',
            }
          }}
        >
          Enter Command Center
        </Button>
      </Box>
    </Box>
  );
};

export default Login;
