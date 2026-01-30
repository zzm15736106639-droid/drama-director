
import React, { useEffect } from 'react';

// Simplified interface to match existing usages if any
interface ApiKeyCheckerProps {
  onReady: () => void;
}

// This component now does nothing but immediately signal "ready" and render nothing.
// This ensures that even if it is mistakenly used, the "Select API Key" screen will NOT appear.
const ApiKeyChecker: React.FC<ApiKeyCheckerProps> = ({ onReady }) => {
  useEffect(() => {
    onReady();
  }, [onReady]);

  return null;
};

export default ApiKeyChecker;
