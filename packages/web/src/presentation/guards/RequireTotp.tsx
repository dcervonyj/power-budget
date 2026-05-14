import React from 'react';
import { Outlet } from 'react-router-dom';

function isTotpVerified(): boolean {
  // Placeholder: real logic comes from AuthView in WEB-003
  return !!sessionStorage.getItem('totp_verified');
}

export function RequireTotp() {
  // Real logic in WEB-003 — for now treat missing as "not required"
  void isTotpVerified();
  return <Outlet />;
}
