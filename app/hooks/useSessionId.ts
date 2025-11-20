import { useEffect, useState } from 'react';

// Generate session ID immediately (not in useEffect)
function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return '';
  
  let storedSessionId = sessionStorage.getItem('synapseSessionId');
  
  if (!storedSessionId) {
    storedSessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    sessionStorage.setItem('synapseSessionId', storedSessionId);
    console.log('🆕 New session created:', storedSessionId);
  } else {
    console.log('♻️ Existing session loaded:', storedSessionId);
  }
  
  return storedSessionId;
}

// Generate or retrieve session ID
export function useSessionId() {
  const [sessionId, setSessionId] = useState<string>('');

  useEffect(() => {
    // Initialize session ID on mount
    const id = getOrCreateSessionId();
    setSessionId(id);
  }, []);

  const resetSession = () => {
    const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    sessionStorage.setItem('synapseSessionId', newSessionId);
    setSessionId(newSessionId);
    console.log('🔄 Session reset:', newSessionId);
    return newSessionId;
  };

  return { sessionId, resetSession };
}
