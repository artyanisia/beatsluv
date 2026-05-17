import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8001";

  const getErrorMessage = async (response, fallback) => {
    const text = await response.text();
    if (!text) {
      return fallback;
    }

    try {
      const data = JSON.parse(text);
      return data.detail || fallback;
    } catch {
      return text;
    }
  };

  useEffect(() => {
    if (token) {
      validateToken();
    } else {
      setLoading(false);
    }
  }, [token]);

  const validateToken = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        console.warn('Token validation failed, logging out');
        logout();
      }
    } catch (error) {
      console.error('Token validation failed:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        const data = await response.json();
        setToken(data.access_token);
        setUser(data.user);
        localStorage.setItem('token', data.access_token);
        return { success: true };
      } else {
        const error = await getErrorMessage(response, 'Login failed');
        return { success: false, error };
      }
    } catch (error) {
      return { success: false, error: `Network error: ${error.message}` };
    }
  };

  const checkEmailExists = async (email) => {
    const response = await fetch(
      `${API_BASE_URL}/auth/exists?email=${encodeURIComponent(email)}`,
    );

    if (!response.ok) {
      const error = await getErrorMessage(response, 'Could not check account');
      throw new Error(error);
    }

    const data = await response.json();
    return data.exists;
  };

  const signup = async (email, password) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        // Auto-login after signup
        const loginResult = await login(email, password);
        return loginResult;
      } else {
        const error = await getErrorMessage(response, 'Signup failed');
        return { success: false, error };
      }
    } catch (error) {
      return { success: false, error: `Network error: ${error.message}` };
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
  };

  const getAuthHeaders = () => {
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  };

  const value = {
    user,
    token,
    loading,
    login,
    signup,
    checkEmailExists,
    logout,
    getAuthHeaders,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
