import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Menu from '@mui/material/Menu';
import MenuIcon from '@mui/icons-material/Menu';
import Container from '@mui/material/Container';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';

import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { HomeRounded, GitHub } from '@mui/icons-material';
import HowToPlay from './HowToPlay';

const navItems = [
  { href: '/', label: 'Home', icon: <HomeRounded /> },
  { href: 'https://github.com/vipulreddyvemula/Generals', label: 'GitHub', icon: <GitHub /> },
];

function Navbar() {
  const [anchorElNav, setAnchorElNav] = useState(null);
  const [show, setShow] = useState(false);
  const router = useRouter();

  const handleOpenNavMenu = (event: any) => setAnchorElNav(event.currentTarget);
  const handleCloseNavMenu = () => setAnchorElNav(null);
  const toggleShow = () => setShow(!show);

  return (
    <AppBar
      position="fixed"
      className="navbar"
      sx={{
        background: 'linear-gradient(90deg, rgba(5,10,25,0.97) 0%, rgba(10,20,50,0.97) 100%)',
        borderBottom: '1px solid rgba(0,212,255,0.15)',
        backdropFilter: 'blur(10px)',
        boxShadow: 'none',
      }}
    >
      <Container className="dock" sx={{ boxShadow: 0 }}>
        {/* Mobile */}
        <Box sx={{ flexGrow: 1, display: { xs: 'flex', md: 'none' } }}>
          <IconButton size="large" onClick={handleOpenNavMenu} color="inherit">
            <MenuIcon />
          </IconButton>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Typography
              sx={{
                fontWeight: 800,
                letterSpacing: 3,
                fontSize: '1rem',
                background: 'linear-gradient(90deg, #00d4ff, #7a00ff)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              COMMANDER MODE
            </Typography>
          </Box>
          <Menu
            id="menu-appbar"
            anchorEl={anchorElNav}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            keepMounted
            transformOrigin={{ vertical: 'top', horizontal: 'left' }}
            open={Boolean(anchorElNav)}
            onClose={handleCloseNavMenu}
            sx={{ display: { xs: 'block', md: 'none' } }}
          >
            {navItems.map(item => (
              <MenuItem key={item.href} onClick={handleCloseNavMenu}>
                <Link href={item.href}>
                  <Typography textAlign="center">{item.label}</Typography>
                </Link>
              </MenuItem>
            ))}
          </Menu>
        </Box>

        {/* Desktop */}
        <Box sx={{ flexGrow: 1, justifyContent: 'space-between', display: { xs: 'none', md: 'flex' }, alignItems: 'center' }}>
          {/* Brand */}
          <Link href="/" style={{ textDecoration: 'none' }}>
            <Typography
              sx={{
                fontWeight: 800,
                letterSpacing: 4,
                fontSize: '1.1rem',
                background: 'linear-gradient(90deg, #00d4ff, #7a00ff)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                cursor: 'pointer',
              }}
            >
              ⚔ COMMANDER MODE
            </Typography>
          </Link>

          {/* Nav links */}
          <Box>
            {navItems.map(item => (
              <Link href={item.href} key={item.href}>
                <Button
                  onClick={handleCloseNavMenu}
                  sx={{ textTransform: 'none', fontSize: '0.9rem', marginX: '6px', color: 'rgba(255,255,255,0.8)' }}
                  startIcon={item.icon}
                >
                  {item.label}
                </Button>
              </Link>
            ))}
          </Box>

          {/* How to play */}
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Button
              variant="outlined"
              size="small"
              onClick={toggleShow}
              sx={{
                borderColor: 'rgba(0,212,255,0.4)',
                color: '#00d4ff',
                fontSize: '0.8rem',
                '&:hover': { borderColor: '#00d4ff', background: 'rgba(0,212,255,0.08)' }
              }}
            >
              How to Play
            </Button>
            <HowToPlay show={show} toggleShow={toggleShow} />
          </Box>
        </Box>
      </Container>
    </AppBar>
  );
}

export default Navbar;
