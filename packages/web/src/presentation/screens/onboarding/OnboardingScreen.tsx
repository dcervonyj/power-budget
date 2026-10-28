import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTE_PATHS } from '../../../infrastructure/navigation/routePaths.js';
import { OnboardingWizard } from './OnboardingWizard.js';

export function OnboardingScreen(): React.JSX.Element {
  const navigate = useNavigate();

  function handleComplete(): void {
    void navigate(ROUTE_PATHS.dashboard);
  }

  return <OnboardingWizard onComplete={handleComplete} />;
}
