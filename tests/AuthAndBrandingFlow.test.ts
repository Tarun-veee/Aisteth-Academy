import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { SignInScreen } from '../src/views/SignInScreen';
import { SignUpScreen } from '../src/views/SignUpScreen';
import { ForgotPasswordScreen } from '../src/views/ForgotPasswordScreen';
import { Header } from '../src/components/common/Header';
import { AuthService } from '../src/services/AuthService';
import { StorageRepository } from '../src/repositories/StorageRepository';
import {
  INDIAN_STATES_AND_UTS,
  STATE_DISTRICTS_MAP,
  getDistrictsForState,
  isValidIndianState
} from '../src/data/indiaLocations';

describe('Auth and Branding Flow', () => {
  let authService: AuthService;
  let storageRepo: StorageRepository;

  beforeEach(() => {
    storageRepo = new StorageRepository();
    authService = new AuthService(storageRepo);
  });

  describe('Logo Branding Integration', () => {
    it('renders the official company logo on SignInScreen', () => {
      const html = renderToString(
        React.createElement(SignInScreen, {
          onSuccess: () => {},
          onNavigateSignUp: () => {},
          onNavigateForgotPassword: () => {},
        })
      );
      expect(html).toContain('src="/assets/images/aisteth_logo.png"');
      expect(html).toContain('alt="AiSteth Official Logo"');
    });

    it('renders the official company logo on SignUpScreen', () => {
      const html = renderToString(
        React.createElement(SignUpScreen, {
          onSuccess: () => {},
          onNavigateSignIn: () => {},
        })
      );
      expect(html).toContain('src="/assets/images/aisteth_logo.png"');
      expect(html).toContain('alt="AiSteth Official Logo"');
    });

    it('renders the official company logo on ForgotPasswordScreen', () => {
      const html = renderToString(
        React.createElement(ForgotPasswordScreen, {
          onNavigateSignIn: () => {},
        })
      );
      expect(html).toContain('src="/assets/images/aisteth_logo.png"');
      expect(html).toContain('alt="AiSteth Official Logo"');
    });

    it('renders the official compact logo inside Header', () => {
      const html = renderToString(
        React.createElement(Header, {
          title: 'AiSteth Academy',
          streakCount: 5,
          xpCount: 200,
        })
      );
      expect(html).toContain('src="/assets/images/aisteth_logo.png"');
      expect(html).toContain('alt="AiSteth"');
    });
  });

  describe('SignInScreen View & Form Structure', () => {
    it('renders all required form controls and copy', () => {
      const html = renderToString(
        React.createElement(SignInScreen, {
          onSuccess: () => {},
          onNavigateSignUp: () => {},
          onNavigateForgotPassword: () => {},
        })
      );
      expect(html).toContain('Welcome back');
      expect(html).toContain('Email or Phone Number');
      expect(html).toContain('Password');
      expect(html).toContain('Forgot password?');
      expect(html).toContain('SIGN IN');
      expect(html).toContain('Create account');
    });
  });

  describe('SignUpScreen View & Form Structure', () => {
    it('renders all supported profile fields and role options', () => {
      const html = renderToString(
        React.createElement(SignUpScreen, {
          onSuccess: () => {},
          onNavigateSignIn: () => {},
        })
      );
      expect(html).toContain('Create your account');
      expect(html).toContain('Full Name');
      expect(html).toContain('Role');
      expect(html).toContain('ASHA Health Worker');
      expect(html).toContain('Anganwadi Worker');
      expect(html).toContain('Health Volunteer');
      expect(html).toContain('Health Centre / Sub-Centre');
      expect(html).toContain('Email or Phone Number');
      expect(html).toContain('Confirm Password');
      expect(html).toContain('CREATE ACCOUNT');
      expect(html).toContain('Sign in');
    });

    it('does not render State and District dropdowns in SignUpScreen', () => {
      const html = renderToString(
        React.createElement(SignUpScreen, {
          onSuccess: () => {},
          onNavigateSignIn: () => {},
        })
      );
      expect(html).not.toContain('Select state');
      expect(html).not.toContain('Select district');
      expect(html).toContain('Health Centre / Sub-Centre');
    });
  });

  describe('India Locations Dataset & Dependent Behavior', () => {
    it('contains all 36 Indian States and Union Territories', () => {
      expect(INDIAN_STATES_AND_UTS.length).toBe(36);
      expect(Object.keys(STATE_DISTRICTS_MAP).length).toBe(36);
    });

    it('returns sorted districts for a given state', () => {
      const karnatakaDistricts = getDistrictsForState('Karnataka');
      expect(karnatakaDistricts.length).toBeGreaterThan(25);
      expect(karnatakaDistricts).toContain('Bengaluru Urban');
      expect(karnatakaDistricts).toContain('Mysuru (Mysore)');
      expect(karnatakaDistricts).toContain('Dakshina Kannada');

      const biharDistricts = getDistrictsForState('Bihar');
      expect(biharDistricts).toContain('Patna');
      expect(biharDistricts).toContain('Gaya');
      expect(biharDistricts).toContain('Muzaffarpur');

      const maharashtraDistricts = getDistrictsForState('Maharashtra');
      expect(maharashtraDistricts).toContain('Pune');
      expect(maharashtraDistricts).toContain('Mumbai City');
      expect(maharashtraDistricts).toContain('Nagpur');
    });

    it('returns empty array for invalid or empty state', () => {
      expect(getDistrictsForState('')).toEqual([]);
      expect(getDistrictsForState('Unknown State')).toEqual([]);
    });

    it('validates Indian state correctly', () => {
      expect(isValidIndianState('Karnataka')).toBe(true);
      expect(isValidIndianState('Delhi')).toBe(true);
      expect(isValidIndianState('NonExistentState')).toBe(false);
    });
  });

  describe('ForgotPasswordScreen View', () => {
    it('renders recovery instructions and form input', () => {
      const html = renderToString(
        React.createElement(ForgotPasswordScreen, {
          onNavigateSignIn: () => {},
        })
      );
      expect(html).toContain('Reset Password');
      expect(html).toContain('Email or Phone Number');
      expect(html).toContain('SEND RECOVERY INSTRUCTIONS');
      expect(html).toContain('Return to Sign In');
    });
  });

  describe('AuthService Validation & Authentication Logic', () => {
    it('validates email addresses correctly', () => {
      expect(AuthService.isValidIdentifier('asha@health.gov.in')).toBe(true);
      expect(AuthService.isValidIdentifier('user.name+tag@example.com')).toBe(true);
      expect(AuthService.isValidIdentifier('invalid-email')).toBe(false);
      expect(AuthService.isValidIdentifier('')).toBe(false);
    });

    it('validates 10-digit mobile numbers correctly', () => {
      expect(AuthService.isValidIdentifier('9876543210')).toBe(true);
      expect(AuthService.isValidIdentifier('+91 9876543210')).toBe(true);
      expect(AuthService.isValidIdentifier('12345')).toBe(false);
    });

    it('blocks sign in with invalid identifier', async () => {
      const result = await authService.signIn({
        identifier: 'invalid',
        password: 'password123',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('valid email address or 10-digit phone number');
    });

    it('blocks sign in with short password', async () => {
      const result = await authService.signIn({
        identifier: '9876543210',
        password: '123',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('at least 6 characters');
    });

    it('successfully signs in with valid credentials and creates session', async () => {
      const result = await authService.signIn({
        identifier: 'asha@health.gov.in',
        password: 'password123',
      });
      expect(result.success).toBe(true);
      expect(result.profile).toBeDefined();
      expect(authService.isAuthenticated()).toBe(true);
    });

    it('blocks sign up when required fields are missing', async () => {
      const result = await authService.signUp({
        name: '',
        role: 'ASHA_WORKER',
        healthSubCentre: '',
        district: '',
        state: '',
        identifier: 'invalid',
        password: '123',
      });
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('successfully signs up and stores profile with healthSubCentre location', async () => {
      const result = await authService.signUp({
        name: 'Sunita Devi',
        role: 'ASHA_WORKER',
        healthSubCentre: 'Kalyanpur Sub-Centre',
        identifier: '9876543210',
        password: 'securePassword123',
      });
      expect(result.success).toBe(true);
      expect(result.profile?.name).toBe('Sunita Devi');
      expect(result.profile?.healthSubCentre).toBe('Kalyanpur Sub-Centre');
      expect(authService.isAuthenticated()).toBe(true);
    });

    it('clears session on sign out', async () => {
      await authService.signIn({
        identifier: '9876543210',
        password: 'password123',
      });
      expect(authService.isAuthenticated()).toBe(true);

      await authService.signOut();
      expect(authService.isAuthenticated()).toBe(false);
    });

    it('handles forgot password request for valid identifier', async () => {
      const result = await authService.forgotPassword('9876543210');
      expect(result.success).toBe(true);
      expect(result.message).toContain('Recovery instructions');
    });
  });
});
