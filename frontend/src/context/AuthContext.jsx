import { createContext, useContext, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { getConsentStatus, getMe, login as apiLogin } from '../api/client.js';

const AuthContext = createContext(null);

function isTokenValid(rawToken) {
  if (!rawToken || typeof rawToken !== 'string') return false;
  const parts = rawToken.split('.');
  if (parts.length !== 3) return false;
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (payload.exp && payload.exp * 1000 < Date.now()) return false;
    return true;
  } catch (err) {
    return false;
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!token);
  const [consent, setConsent] = useState(null);
  const [consentLoading, setConsentLoading] = useState(!!token);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadUser() {
      if (!token) {
        setLoading(false);
        return;
      }

      if (!isTokenValid(token)) {
        localStorage.removeItem('token');
        localStorage.removeItem('last_role');
        setToken(null);
        setUser(null);
        setConsent(null);
        setConsentLoading(false);
        setError('');
        setLoading(false);
        return;
      }

      try {
        const me = await getMe();
        setUser(me);
        setConsentLoading(true);
        try {
          const consentData = await getConsentStatus();
          setConsent(consentData);
        } catch (err) {
          setConsent(null);
        } finally {
          setConsentLoading(false);
        }
      } catch (err) {
        localStorage.removeItem('token');
        localStorage.removeItem('last_role');
        setToken(null);
        setUser(null);
        setConsent(null);
        setError('');
      } finally {
        setLoading(false);
        setConsentLoading(false);
      }
    }
    loadUser();
  }, [token]);

  async function refreshConsent() {
    if (!token) return;
    setConsentLoading(true);
    try {
      const consentData = await getConsentStatus();
      setConsent(consentData);
    } finally {
      setConsentLoading(false);
    }
  }

  async function refreshUser() {
    if (!token) return;
    const me = await getMe();
    setUser(me);
  }

  async function login(email, password) {
    setError('');
    const res = await apiLogin(email, password);
    localStorage.setItem('token', res.access_token);
    setToken(res.access_token);
    const me = await getMe();
    setUser(me);
    localStorage.setItem('last_role', me.type);
    try {
      const consentData = await getConsentStatus();
      setConsent(consentData);
    } catch (err) {
      setConsent(null);
    }
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('last_role');
    setUser(null);
    setToken(null);
    setConsent(null);
    setConsentLoading(false);
    setError('');
  }

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        loading,
        consent,
        consentLoading,
        error,
        login,
        logout,
        refreshConsent,
        refreshUser,
        setError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

export function RequireAuth({ children, role, requireConsent = true }) {
  const { token, user, loading, consent, consentLoading } = useAuth();
  if (loading || consentLoading) {
    return <div className="p-6 text-center text-sm text-gray-600">Carregando sessao...</div>;
  }
  if (!token || !user) return <Navigate to="/login" replace />;
  if (role && user.type !== role) {
    const fallback = user.type === 'ADMIN'
      ? '/admin/professores'
      : user.type === 'PROFESSOR'
        ? '/professor/dashboard'
        : '/aluno/dashboard';
    return <Navigate to={fallback} replace />;
  }
  if (requireConsent && (!consent || !consent.accepted)) {
    return <Navigate to="/conta" replace />;
  }
  return children;
}
