import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken]           = useState(() => localStorage.getItem('ca_token'));
  const [user, setUser]             = useState(null);
  const [loading, setLoading]       = useState(true);
  const [trialExpired, setTrialExpired] = useState(false);

  // Listen for 402 events dispatched by api.js
  useEffect(() => {
    const handler = () => setTrialExpired(true);
    window.addEventListener('ca:trialExpired', handler);
    return () => window.removeEventListener('ca:trialExpired', handler);
  }, []);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => setUser(data))
      .catch(() => { localStorage.removeItem('ca_token'); setToken(null); })
      .finally(() => setLoading(false));
  }, [token]);

  const login = async (email, password) => {
    const r = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Erreur de connexion');
    localStorage.setItem('ca_token', data.token);
    setToken(data.token);
    setUser(data.user);
  };

  const signup = async (email, password, nomEntreprise) => {
    const r = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, nomEntreprise }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Erreur d\'inscription');
    localStorage.setItem('ca_token', data.token);
    setToken(data.token);
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem('ca_token');
    setToken(null);
    setUser(null);
    setTrialExpired(false);
  };

  const refreshUser = async () => {
    if (!token) return;
    const r = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
    if (r.ok) setUser(await r.json());
  };

  return (
    <AuthContext.Provider value={{ token, user, loading, trialExpired, login, signup, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
