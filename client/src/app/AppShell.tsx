import {
  AppBar,
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  useMediaQuery
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import { Link as RouterLink, Outlet, useLocation } from "react-router-dom";
import TrackChangesIcon from "@mui/icons-material/TrackChanges";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import PeopleIcon from "@mui/icons-material/People";
import PersonIcon from "@mui/icons-material/Person";
import SettingsIcon from "@mui/icons-material/Settings";
import LogoutIcon from "@mui/icons-material/Logout";

import React from "react";
import { useAuth } from "../features/auth/AuthContext";

const drawerWidth = 280;

export function AppShell() {
  const { user, logout } = useAuth();
  const loc = useLocation();
  const isSmDown = useMediaQuery("(max-width: 900px)");
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const nav = [
    { to: "/", label: "Dashboard", icon: <TrackChangesIcon /> },
    { to: "/upload", label: "Upload Consignments", icon: <UploadFileIcon /> },
    { to: "/profile", label: "My profile", icon: <PersonIcon /> },
    ...(user?.role === "superadmin"
      ? [{ to: "/users", label: "Users", icon: <PeopleIcon /> }]
      : []),
    ...(user?.role === "superadmin" || user?.role === "admin"
      ? [{ to: "/settings", label: "Settings", icon: <SettingsIcon /> }]
      : [])
  ];

  const drawerContent = (
    <>
      <Toolbar />
      <Box sx={{ px: 1.5, py: 1 }}>
        <Typography variant="caption" sx={{ opacity: 0.7, px: 1 }}>
          Navigation
        </Typography>
      </Box>
      <List sx={{ px: 1 }}>
        {nav.map((i) => (
          <ListItemButton
            key={i.to}
            component={RouterLink}
            to={i.to}
            selected={loc.pathname === i.to}
            onClick={() => setMobileOpen(false)}
            sx={{ borderRadius: 2, mb: 0.5 }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>{i.icon}</ListItemIcon>
            <ListItemText primary={i.label} />
          </ListItemButton>
        ))}
      </List>
      <Divider sx={{ mt: "auto" }} />
      <Box sx={{ p: 2 }}>
        <Typography variant="caption" sx={{ opacity: 0.7 }}>
          Tip: Upload via Excel or paste consignments.
        </Typography>
      </Box>
    </>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100%" }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          backdropFilter: "blur(12px)",
          background: "rgba(11,16,32,0.7)",
          borderBottom: "1px solid rgba(255,255,255,0.08)"
        }}
      >
        <Toolbar sx={{ gap: 2 }}>
          {isSmDown ? (
            <IconButton color="inherit" onClick={() => setMobileOpen(true)} aria-label="Open menu">
              <MenuIcon />
            </IconButton>
          ) : null}
          <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: -0.3, flex: 1 }}>
            India Post Tracking
          </Typography>
          <Typography sx={{ opacity: 0.8, display: { xs: "none", sm: "block" } }}>
            {user?.username} ({user?.role})
          </Typography>
          <Button
            color="inherit"
            startIcon={<LogoutIcon />}
            onClick={() => logout()}
            sx={{ borderRadius: 2 }}
          >
            Logout
          </Button>
        </Toolbar>
      </AppBar>

      <Drawer
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        variant="temporary"
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: "block", md: "none" },
          [`& .MuiDrawer-paper`]: {
            width: drawerWidth,
            boxSizing: "border-box",
            borderRight: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(17,24,39,0.85)",
            backdropFilter: "blur(10px)"
          }
        }}
      >
        {drawerContent}
      </Drawer>

      <Drawer
        variant="permanent"
        sx={{
          display: { xs: "none", md: "block" },
          width: drawerWidth,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: {
            width: drawerWidth,
            boxSizing: "border-box",
            borderRight: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(17,24,39,0.55)",
            backdropFilter: "blur(10px)"
          }
        }}
      >
        {drawerContent}
      </Drawer>

      <Box sx={{ flex: 1, p: { xs: 1.5, sm: 2, md: 3 } }}>
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
}

