import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

function hasToken(): boolean {
  return !!localStorage.getItem('access_token');
}

export function RequireAuth() {
  const location = useLocation();
  if (!hasToken()) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <Outlet />;
}
