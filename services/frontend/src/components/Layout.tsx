import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  BottomNavigation,
  BottomNavigationAction,
  Paper,
  Box,
  Avatar,
  Menu,
  MenuItem,
} from '@mui/material';
import {
  Favorite,
  Chat,
  Person,
  MusicNote,
  Logout,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

const Layout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    handleProfileMenuClose();
    navigate('/login');
  };

  const getCurrentTab = () => {
    switch (location.pathname) {
      case '/swipe':
        return 0;
      case '/matches':
        return 1;
      case '/profile':
        return 2;
      default:
        return 0;
    }
  };

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    switch (newValue) {
      case 0:
        navigate('/swipe');
        break;
      case 1:
        navigate('/matches');
        break;
      case 2:
        navigate('/profile');
        break;
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Top App Bar */}
      <AppBar position="static" sx={{ backgroundColor: '#1e1e1e' }}>
        <Toolbar>
          <MusicNote sx={{ mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Sptinder
          </Typography>
          <IconButton
            size="large"
            edge="end"
            aria-label="account of current user"
            aria-controls="profile-menu"
            aria-haspopup="true"
            onClick={handleProfileMenuOpen}
            color="inherit"
          >
            <Avatar
              src={user?.profileImageUrl}
              alt={user?.displayName || 'User'}
              sx={{ width: 32, height: 32 }}
            >
              {user?.displayName?.charAt(0) || 'U'}
            </Avatar>
          </IconButton>
          <Menu
            id="profile-menu"
            anchorEl={anchorEl}
            anchorOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            keepMounted
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            open={Boolean(anchorEl)}
            onClose={handleProfileMenuClose}
          >
            <MenuItem onClick={() => { navigate('/profile'); handleProfileMenuClose(); }}>
              <Person sx={{ mr: 1 }} />
              Profile
            </MenuItem>
            <MenuItem onClick={handleLogout}>
              <Logout sx={{ mr: 1 }} />
              Logout
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {/* Main Content */}
      <Box sx={{ flex: 1, p: 0 }}>
        <Outlet />
      </Box>

      {/* Bottom Navigation */}
      <Paper sx={{ position: 'fixed', bottom: 0, left: 0, right: 0 }} elevation={3}>
        <BottomNavigation
          value={getCurrentTab()}
          onChange={handleTabChange}
          sx={{ backgroundColor: '#1e1e1e' }}
        >
          <BottomNavigationAction
            label="Swipe"
            icon={<MusicNote />}
            sx={{
              color: getCurrentTab() === 0 ? '#1db954' : '#b3b3b3',
              '&.Mui-selected': {
                color: '#1db954',
              },
            }}
          />
          <BottomNavigationAction
            label="Matches"
            icon={<Favorite />}
            sx={{
              color: getCurrentTab() === 1 ? '#1db954' : '#b3b3b3',
              '&.Mui-selected': {
                color: '#1db954',
              },
            }}
          />
          <BottomNavigationAction
            label="Profile"
            icon={<Person />}
            sx={{
              color: getCurrentTab() === 2 ? '#1db954' : '#b3b3b3',
              '&.Mui-selected': {
                color: '#1db954',
              },
            }}
          />
        </BottomNavigation>
      </Paper>

      {/* Add padding to account for bottom navigation */}
      <Box sx={{ height: 56 }} />
    </Box>
  );
};

export default Layout;