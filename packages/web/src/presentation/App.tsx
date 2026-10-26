import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { FormattedMessage } from 'react-intl';
import { RequireAuth } from './guards/RequireAuth.js';
import { ROUTE_PATHS } from '../infrastructure/navigation/routePaths.js';
import { SettingsProfileTab } from './screens/settings/SettingsProfileTab.js';
import { SettingsLocaleTab } from './screens/settings/SettingsLocaleTab.js';
import { SettingsCurrencyTab } from './screens/settings/SettingsCurrencyTab.js';
import { SettingsDataTab } from './screens/settings/SettingsDataTab.js';
import { AppShell } from './shell/AppShell.js';
import { AppearanceSettings } from './shell/AppearanceSettings.js';
import { AuthLayout } from './shell/AuthLayout.js';

// Auth screens — lazy loaded
const LoginScreen = lazy(() =>
  import('./screens/auth/LoginScreen.js').then((m) => ({ default: m.LoginScreen })),
);
const RegisterScreen = lazy(() =>
  import('./screens/auth/RegisterScreen.js').then((m) => ({ default: m.RegisterScreen })),
);
const MagicLinkScreen = lazy(() =>
  import('./screens/auth/MagicLinkScreen.js').then((m) => ({ default: m.MagicLinkScreen })),
);
const TotpEnrollmentScreen = lazy(() =>
  import('./screens/auth/TotpEnrollmentScreen.js').then((m) => ({
    default: m.TotpEnrollmentScreen,
  })),
);
const BankConsentCallbackScreen = lazy(() =>
  import('./screens/auth/BankConsentCallbackScreen.js').then((m) => ({
    default: m.BankConsentCallbackScreen,
  })),
);

// Onboarding screen — lazy loaded
const OnboardingScreen = lazy(() =>
  import('./screens/onboarding/OnboardingScreen.js').then((m) => ({
    default: m.OnboardingScreen,
  })),
);

// App screens — lazy loaded
const DashboardScreen = lazy(() =>
  import('./screens/app/DashboardScreen.js').then((m) => ({ default: m.DashboardScreen })),
);
const TransactionDetailScreen = lazy(() =>
  import('./screens/app/TransactionDetailScreen.js').then((m) => ({
    default: m.TransactionDetailScreen,
  })),
);
const PlansListScreen = lazy(() =>
  import('./screens/app/PlansListScreen.js').then((m) => ({ default: m.PlansListScreen })),
);
const PlanEditorScreen = lazy(() =>
  import('./screens/app/PlanEditorScreen.js').then((m) => ({ default: m.PlanEditorScreen })),
);
const PlanDashboardScreen = lazy(() =>
  import('./screens/app/PlanDashboardScreen.js').then((m) => ({
    default: m.PlanDashboardScreen,
  })),
);
const BankConnectionsScreen = lazy(() =>
  import('./screens/app/BankConnectionsScreen.js').then((m) => ({
    default: m.BankConnectionsScreen,
  })),
);
const AddBankConnectionScreen = lazy(() =>
  import('./screens/app/AddBankConnectionScreen.js').then((m) => ({
    default: m.AddBankConnectionScreen,
  })),
);
const CategoriesScreen = lazy(() =>
  import('./screens/app/CategoriesScreen.js').then((m) => ({ default: m.CategoriesScreen })),
);
const HouseholdScreen = lazy(() =>
  import('./screens/app/HouseholdScreen.js').then((m) => ({ default: m.HouseholdScreen })),
);
const SettingsScreen = lazy(() =>
  import('./screens/app/SettingsScreen.js').then((m) => ({ default: m.SettingsScreen })),
);
const AcceptInviteScreen = lazy(() =>
  import('./screens/app/AcceptInviteScreen.js').then((m) => ({ default: m.AcceptInviteScreen })),
);
const AuditLogScreen = lazy(() =>
  import('./screens/app/AuditLogScreen.js').then((m) => ({ default: m.AuditLogScreen })),
);

/**
 * Every route of the web app, registered once (DSN-017) with the paths of the CLN-035 route
 * table: the screen tickets DSN-020..028 restyle the screens behind these routes without touching
 * this file. Auth and onboarding render in the frosted AuthLayout, the signed-in app in the
 * AppShell (header nav, tab bar, account menu). Paths and deep links are unchanged.
 */
export function App() {
  return (
    <Suspense
      fallback={
        <div>
          <FormattedMessage id="app.loading" defaultMessage="Loading…" />
        </div>
      }
    >
      <Routes>
        <Route element={<AuthLayout />}>
          {/* Public auth routes */}
          <Route path={ROUTE_PATHS.login} element={<LoginScreen />} />
          <Route path={ROUTE_PATHS.register} element={<RegisterScreen />} />
          <Route path={ROUTE_PATHS.magicLink} element={<MagicLinkScreen />} />

          {/* Signed in, but before or outside the app: 2FA, onboarding, bank consent, invites */}
          <Route element={<RequireAuth />}>
            <Route path={ROUTE_PATHS.totpEnroll} element={<TotpEnrollmentScreen />} />
            <Route path={ROUTE_PATHS.onboarding} element={<OnboardingScreen />} />
            <Route path={ROUTE_PATHS.bankConsentCallback} element={<BankConsentCallbackScreen />} />
            {/* The household invite email links here (CLN-006). */}
            <Route path={ROUTE_PATHS.acceptInvite} element={<AcceptInviteScreen />} />
          </Route>
        </Route>

        {/* Protected app routes */}
        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route path={ROUTE_PATHS.dashboard} element={<DashboardScreen />} />
            {/* One route, so opening or closing a detail keeps the list (rows, toast). */}
            <Route path={ROUTE_PATHS.transactionDetail} element={<TransactionDetailScreen />} />
            <Route path={ROUTE_PATHS.plans} element={<PlansListScreen />} />
            <Route path={ROUTE_PATHS.planEditor} element={<PlanEditorScreen />} />
            <Route path={ROUTE_PATHS.planDashboard} element={<PlanDashboardScreen />} />
            <Route path={ROUTE_PATHS.bankConnections} element={<BankConnectionsScreen />} />
            <Route path={ROUTE_PATHS.addBankConnection} element={<AddBankConnectionScreen />} />
            <Route path={ROUTE_PATHS.categories} element={<CategoriesScreen />} />
            <Route path={ROUTE_PATHS.household} element={<HouseholdScreen />} />
            <Route path={ROUTE_PATHS.settings} element={<SettingsScreen />}>
              <Route index element={<Navigate to={ROUTE_PATHS.settingsProfile} replace />} />
              <Route path={ROUTE_PATHS.settingsProfile} element={<SettingsProfileTab />} />
              {/* Appearance (System / Night / Day): the settings tab itself comes with DSN-028. */}
              <Route path={ROUTE_PATHS.settingsAppearance} element={<AppearanceSettings />} />
              <Route path={ROUTE_PATHS.settingsLocale} element={<SettingsLocaleTab />} />
              <Route path={ROUTE_PATHS.settingsCurrency} element={<SettingsCurrencyTab />} />
              <Route path={ROUTE_PATHS.settingsData} element={<SettingsDataTab />} />
            </Route>
            <Route path={ROUTE_PATHS.audit} element={<AuditLogScreen />} />
          </Route>
        </Route>

        {/* Default redirect */}
        <Route path="/" element={<Navigate to={ROUTE_PATHS.dashboard} replace />} />
        <Route path="*" element={<Navigate to={ROUTE_PATHS.dashboard} replace />} />
      </Routes>
    </Suspense>
  );
}
