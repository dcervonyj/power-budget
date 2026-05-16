import React from 'react';
import { useNavigate } from 'react-router-dom';
import { OnboardingWizard } from './OnboardingWizard.js';

export function OnboardingScreen(): React.JSX.Element {
  const navigate = useNavigate();

  function handleComplete(): void {
    navigate('/dashboard');
  }

  return <OnboardingWizard onComplete={handleComplete} />;
}
