import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { RequireAuth } from './guards/RequireAuth.js';

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
const OAuthCallbackScreen = lazy(() =>
  import('./screens/auth/OAuthCallbackScreen.js').then((m) => ({
    default: m.OAuthCallbackScreen,
  })),
);
const TotpEnrollmentScreen = lazy(() =>
  import('./screens/auth/TotpEnrollmentScreen.js').then((m) => ({
    default: m.TotpEnrollmentScreen,
  })),
);

// App screens — lazy loaded
const DashboardScreen = lazy(() =>
  import('./screens/app/DashboardScreen.js').then((m) => ({ default: m.DashboardScreen })),
);
const TransactionListScreen = lazy(() =>
  import('./screens/app/TransactionListScreen.js').then((m) => ({
    default: m.TransactionListScreen,
  })),
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
const AuditLogScreen = lazy(() =>
  import('./screens/app/AuditLogScreen.js').then((m) => ({ default: m.AuditLogScreen })),
);

export function App() {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <Routes>
        {/* Public auth routes */}
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/register" element={<RegisterScreen />} />
        <Route path="/auth/magic-link" element={<MagicLinkScreen />} />
        <Route path="/auth/oauth/callback" element={<OAuthCallbackScreen />} />

        {/* Protected app routes */}
        <Route element={<RequireAuth />}>
          <Route path="/auth/totp-enroll" element={<TotpEnrollmentScreen />} />
          <Route path="/dashboard" element={<DashboardScreen />} />
          <Route path="/transactions" element={<TransactionListScreen />} />
          <Route path="/transactions/:id" element={<TransactionDetailScreen />} />
          <Route path="/plans" element={<PlansListScreen />} />
          <Route path="/plans/:id" element={<PlanEditorScreen />} />
          <Route path="/plans/:id/dashboard" element={<PlanDashboardScreen />} />
          <Route path="/bank-connections" element={<BankConnectionsScreen />} />
          <Route path="/bank-connections/new" element={<AddBankConnectionScreen />} />
          <Route path="/categories" element={<CategoriesScreen />} />
          <Route path="/household" element={<HouseholdScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="/audit" element={<AuditLogScreen />} />
        </Route>

        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
}
