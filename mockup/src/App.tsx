import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { PortalShell } from './components/layout/PortalShell';
import { Dashboard } from './pages/Dashboard';
import { Resources } from './pages/Resources';
import { ForumCategory } from './pages/ForumCategory';
import { Events } from './pages/Events';
import { Profile } from './pages/Profile';
import { Login } from './pages/Login';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
          <PortalShell>
              <Dashboard />
            </PortalShell>
          } />
        
        <Route
          path="/resources"
          element={
          <PortalShell>
              <Resources />
            </PortalShell>
          } />
        
        <Route
          path="/events"
          element={
          <PortalShell>
              <Events />
            </PortalShell>
          } />
        
        <Route
          path="/forum"
          element={
          <PortalShell>
              <ForumCategory />
            </PortalShell>
          } />
        
        <Route
          path="/profile"
          element={
          <PortalShell>
              <Profile />
            </PortalShell>
          } />
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>);

}