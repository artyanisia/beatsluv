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
          setError(err.message || 'Could not check account.');
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
      return 'No account exists for this email. Please create an account first.';
    }

    if (!isLogin && emailExists) {
      return 'This email already has an account. Please sign in.';
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
      setError('No account exists for this email. Please create an account first.');
      return;
    }

    if (!isLogin && emailExists === true) {
      setError('This email already has an account. Please sign in.');
      return;
    }

    setLoading(true);

    if (!isLogin && password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
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
      setError('An unexpected error occurred');
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
    <div className="auth-container">
      <div className="auth-form">
        <div className="auth-header">
          <h1>BeatsLuv</h1>
          <h2>{isLogin ? 'Sign In' : 'Create Account'}</h2>
          <p>
            {isLogin 
              ? 'Sign in to generate and manage your music tracks' 
              : 'Join BeatsLuv to start creating amazing music'
            }
          </p>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Enter your email"
            />
            {checkingEmail && <span className="field-hint">Checking account...</span>}
            {accountMessage && <span className="field-warning">{accountMessage}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter your password"
              minLength="6"
            />
          </div>

          {!isLogin && (
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="Confirm your password"
                minLength="6"
              />
            </div>
          )}

          <button type="submit" disabled={shouldDisableSubmit} className="auth-button">
            {loading ? 'Please wait...' : (isLogin ? 'Sign In' : 'Create Account')}
          </button>
        </form>

        <div className="auth-toggle">
          <p>
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <button 
              type="button" 
              onClick={toggleMode} 
              className="toggle-button"
            >
              {isLogin ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthForm;
