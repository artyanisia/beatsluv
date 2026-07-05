import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';

const AuthForm = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [emailExists, setEmailExists] = useState(null);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [loading, setLoading] = useState(false);

  const { login, signup, checkEmailExists } = useAuth();

  const normalizedEmail = email.trim().toLowerCase();
  const canCheckEmail = useMemo(
    () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail),
    [normalizedEmail],
  );

  useEffect(() => {
    setError('');

    if (!canCheckEmail) {
      setEmailExists(null);
      setCheckingEmail(false);
      return;
    }

    let cancelled = false;
    setCheckingEmail(true);

    const timeoutId = window.setTimeout(async () => {
      try {
        const exists = await checkEmailExists(normalizedEmail);
        if (!cancelled) {
          setEmailExists(exists);
        }
        } catch (err) {
          if (!cancelled) {
            setEmailExists(null);
            setError(err.message || 'Nu s-a putut verifica contul.');
          }
      } finally {
        if (!cancelled) {
          setCheckingEmail(false);
        }
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [canCheckEmail, checkEmailExists, normalizedEmail, isLogin]);

  const accountMessage = useMemo(() => {
    if (!canCheckEmail || checkingEmail || emailExists === null) {
      return '';
    }

    if (isLogin && !emailExists) {
      return 'Nu exista un cont pentru acest email. Te rugam sa creezi mai intai un cont.';
    }

    if (!isLogin && emailExists) {
      return 'Acest email are deja un cont. Te rugam sa te conectezi.';
    }

    return '';
  }, [canCheckEmail, checkingEmail, emailExists, isLogin]);

  const shouldDisableSubmit =
    loading ||
    checkingEmail ||
    (isLogin && emailExists === false) ||
    (!isLogin && emailExists === true);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (isLogin && emailExists === false) {
      setError('Nu exista un cont pentru acest email. Te rugam sa creezi mai intai un cont.');
      return;
    }

    if (!isLogin && emailExists === true) {
      setError('Acest email are deja un cont. Te rugam sa te conectezi.');
      return;
    }

    setLoading(true);

    if (!isLogin && password !== confirmPassword) {
      setError('Parolele nu se potrivesc');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Parola trebuie sa aiba cel putin 6 caractere');
      setLoading(false);
      return;
    }

    try {
      let result;
      if (isLogin) {
        result = await login(email, password);
      } else {
        result = await signup(email, password);
      }

      if (result.success) {
        // Success! The redirect will happen automatically via AuthContext
        // Clear the form
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        setError('');
      } else {
        setError(result.error);
      }
    } catch (err) {
      console.error('Authentication error:', err);
      setError('A aparut o eroare neasteptata');
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setError('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setEmailExists(null);
    setCheckingEmail(false);
  };

  return (
    <div className="vision-auth-page">
      <div className="vision-auth-card-container">
        <div className="glass-card vision-auth-card">
          <div className="auth-header">
            <h1 className="vision-brand">BeatsLuv</h1>
            <h2 className="vision-welcome">{isLogin ? 'Bine ai revenit' : 'Creeaza cont'}</h2>
            <p className="vision-subtitle">
              {isLogin 
                ? 'Introdu emailul si parola pentru a te conecta' 
                : 'Alatura-te viitorului generarii muzicale cu AI'
              }
            </p>
          </div>

          {error && <div className="vision-error-badge">{error}</div>}

          <form onSubmit={handleSubmit} className="vision-form">
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Adresa ta de email"
                className="vision-input"
              />
              {checkingEmail && <span className="field-hint">Se verifica contul...</span>}
              {accountMessage && <span className="field-warning">{accountMessage}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="password">Parola</label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Parola ta"
                minLength="6"
                className="vision-input"
              />
            </div>

            {!isLogin && (
              <div className="form-group">
                <label htmlFor="confirmPassword">Confirma parola</label>
                <input
                  type="password"
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="Confirma parola"
                  minLength="6"
                  className="vision-input"
                />
              </div>
            )}

            <button type="submit" disabled={shouldDisableSubmit} className="vision-btn-primary">
              {loading ? 'TE RUGAM ASTEAPTA...' : (isLogin ? 'CONECTARE' : 'INREGISTRARE')}
            </button>
          </form>

          <div className="auth-toggle">
            <p>
              {isLogin ? "Nu ai un cont? " : 'Ai deja un cont? '}
              <button 
                type="button" 
                onClick={toggleMode} 
                className="toggle-link"
              >
                {isLogin ? 'Inregistreaza-te' : 'Conecteaza-te'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthForm;

