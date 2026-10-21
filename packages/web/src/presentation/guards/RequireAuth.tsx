import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { tokenStore } from '../../AppProviders.js';

export function RequireAuth(): React.JSX.Element {
  const location = useLocation();
  // Read through the same store the login screen writes to (audit C13): a
  // hard-coded localStorage key here once made every protected route unreachable.
  if (!tokenStore.getAccessToken()) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
