import React, { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { LocaleSwitcher } from '../components/LocaleSwitcher.js';
import { AuthLayoutView } from './AuthLayoutView.js';
import { ShellLoading } from './ShellLoading.js';

/** Layout route for login, register, magic link, 2FA enrolment, onboarding and invites. */
export function AuthLayout(): React.JSX.Element {
  return (
    <AuthLayoutView language={<LocaleSwitcher id="auth-locale-select" />}>
      <Suspense fallback={<ShellLoading />}>
        <Outlet />
      </Suspense>
    </AuthLayoutView>
  );
}
