/**
 * @file AuthContext.jsx
 * @description Authentication & Authorization Context.
 * Manages authenticated user state, loading transitions, and strict role privileges.
 */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { USER_ROLES } from '../models/schema.js';
import { authService } from '../services/firebase/authService.js';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(() => authService.getInitialSession());
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // Initialize and synchronize authentication state
  useEffect(() => {
    const unsubscribe = authService.subscribeToAuth((user) => {
      setCurrentUser(user);
      setLoading(false);
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  /**
   * Log in user
   * @param {string} email
   * @param {string} password
   * @param {string|null} intendedPortal - Optional portal context to verify authorization
   */
  const login = async (email, password, intendedPortal = null) => {
    setLoading(true);
    setAuthError(null);
    try {
      const user = await authService.login(email, password, intendedPortal);
      setCurrentUser(user);
      return user;
    } catch (error) {
      const message = authService.mapAuthError(error);
      setAuthError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Register a new citizen account
   * Role is strictly enforced as CITIZEN.
   */
  const register = async (email, password, displayName) => {
    setLoading(true);
    setAuthError(null);
    try {
      const user = await authService.register(email, password, displayName);
      setCurrentUser(user);
      return user;
    } catch (error) {
      const message = authService.mapAuthError(error);
      setAuthError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Log out active session
   */
  const logout = async () => {
    setLoading(true);
    setAuthError(null);
    try {
      await authService.logout();
      setCurrentUser(null);
    } finally {
      setLoading(false);
    }
  };

  const isDepartmentAdmin = currentUser?.role === USER_ROLES.DEPARTMENT_ADMIN;
  const isSuperAdmin = currentUser?.role === USER_ROLES.SUPER_ADMIN;
  const isAdmin = isDepartmentAdmin || isSuperAdmin || currentUser?.role === USER_ROLES.ADMIN;

  const value = {
    currentUser,
    role: currentUser?.role || null,
    departmentId: currentUser?.departmentId || null,
    isAuthenticated: Boolean(currentUser),
    isCitizen: currentUser?.role === USER_ROLES.CITIZEN,
    isOfficer: currentUser?.role === USER_ROLES.OFFICER,
    isDepartmentAdmin,
    isSuperAdmin,
    isAdmin,
    loading,
    authError,
    setAuthError,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
