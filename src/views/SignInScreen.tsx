import React, { useState } from 'react';
import { Eye, EyeOff, Lock, User, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '../components/common/Button';
import { AuthService, defaultAuthService } from '../services/AuthService';
import { UserProfile } from '../models/user.types';

export interface SignInScreenProps {
  authService?: AuthService;
  onSuccess: (profile: UserProfile) => void;
  onNavigateSignUp: () => void;
  onNavigateForgotPassword: () => void;
}

export const SignInScreen: React.FC<SignInScreenProps> = ({
  authService = defaultAuthService,
  onSuccess,
  onNavigateSignUp,
  onNavigateForgotPassword,
}) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form validation checks
  const isIdentifierValid = identifier.trim().length > 0 && AuthService.isValidIdentifier(identifier);
  const isPasswordValid = password.length >= 6;
  const isFormValid = isIdentifierValid && isPasswordValid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || isLoading) return;

    setErrorMessage(null);
    setIsLoading(true);

    try {
      const result = await authService.signIn({
        identifier: identifier.trim(),
        password: password,
      });

      if (result.success && result.profile) {
        onSuccess(result.profile);
      } else {
        setErrorMessage(result.error || 'Invalid credentials. Please check and try again.');
      }
    } catch {
      setErrorMessage('A network error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col justify-between overflow-y-auto min-h-0 bg-surface-white px-4 sm:px-6 py-6 sm:py-8 select-none">
      <div className="max-w-sm mx-auto w-full flex flex-col items-center">
        {/* Official Company Logo */}
        <div className="flex flex-col items-center mb-4 sm:mb-6">
          <div className="w-20 h-20 sm:w-24 sm:h-24 mb-3 flex items-center justify-center">
            <img
              src="/assets/images/aisteth_logo.png"
              alt="AiSteth Official Logo"
              className="w-full h-full object-contain drop-shadow-xs"
            />
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-brand-900 tracking-tight text-center">
            AiSteth Academy
          </h1>
          <p className="text-xs sm:text-sm font-semibold text-content-secondary text-center mt-1">
            Clinical Auscultation & Skills Training
          </p>
        </div>

        {/* Welcome Text */}
        <div className="w-full text-left mb-5">
          <h2 className="text-base sm:text-lg font-bold text-content-primary">
            Welcome back
          </h2>
          <p className="text-xs sm:text-sm text-content-secondary mt-0.5">
            Continue your daily training journey
          </p>
        </div>

        {/* Error Banner */}
        {errorMessage && (
          <div
            role="alert"
            className="w-full mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2 animate-in fade-in"
          >
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span className="leading-snug">{errorMessage}</span>
          </div>
        )}

        {/* Sign In Form */}
        <form onSubmit={handleSubmit} className="w-full space-y-3.5" noValidate>
          {/* Email / Phone Field */}
          <div>
            <label
              htmlFor="signin-identifier"
              className="block text-xs font-bold text-content-primary mb-1"
            >
              Email or Phone Number <span className="text-rose-500">*</span>
            </label>
            <div className="relative flex items-center">
              <div className="absolute left-3 text-slate-400 pointer-events-none">
                <User className="w-4 h-4" />
              </div>
              <input
                id="signin-identifier"
                type="text"
                autoComplete="username"
                value={identifier}
                onChange={(e) => {
                  setIdentifier(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="e.g. name@health.gov.in or 9876543210"
                className="w-full pl-9 pr-3.5 py-2.5 sm:py-3 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm text-content-primary placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all font-medium"
                aria-required="true"
                disabled={isLoading}
              />
            </div>
            {identifier.length > 0 && !isIdentifierValid && (
              <p className="text-[11px] text-amber-600 font-medium mt-1">
                Please enter a valid email or 10-digit mobile number.
              </p>
            )}
          </div>

          {/* Password Field */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="signin-password"
                className="block text-xs font-bold text-content-primary"
              >
                Password <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={onNavigateForgotPassword}
                className="text-xs font-bold text-brand-600 hover:text-brand-800 transition-colors p-1"
              >
                Forgot password?
              </button>
            </div>
            <div className="relative flex items-center">
              <div className="absolute left-3 text-slate-400 pointer-events-none">
                <Lock className="w-4 h-4" />
              </div>
              <input
                id="signin-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="Enter your password"
                className="w-full pl-9 pr-10 py-2.5 sm:py-3 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm text-content-primary placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all font-medium"
                aria-required="true"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 min-w-[36px] min-h-[36px] flex items-center justify-center cursor-pointer transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            {password.length > 0 && password.length < 6 && (
              <p className="text-[11px] text-amber-600 font-medium mt-1">
                Password must be at least 6 characters.
              </p>
            )}
          </div>

          {/* Sign In Submit Button */}
          <div className="pt-2">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              disabled={!isFormValid || isLoading}
              className="py-3 sm:py-3.5 text-sm font-bold min-h-[48px] shadow-sm flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Signing In...</span>
                </>
              ) : (
                'SIGN IN'
              )}
            </Button>
          </div>
        </form>

        {/* Admin-Led Onboarding Guidance */}
        <div className="w-full mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200 text-left">
          <p className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
            <span>Admin-Led Trainee Onboarding</span>
          </p>
          <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
            Your AuSkill account is created by your RBSK supervisor. Simply enter your registered mobile number and password to begin today's training.
          </p>
        </div>
      </div>

      {/* Footer / Create Account Navigation */}
      <div className="w-full max-w-sm mx-auto text-center pt-5 pb-2 border-t border-slate-100 mt-3">
        <p className="text-xs text-content-secondary">
          Need supervisor assistance or to{' '}
          <button
            type="button"
            onClick={onNavigateSignUp}
            className="font-bold text-brand-600 hover:text-brand-800 hover:underline p-1 cursor-pointer transition-colors"
          >
            Create account
          </button>
          ? Contact your local RBSK coordinator.
        </p>
      </div>
    </div>
  );
};
