import React, { useState } from 'react';
import { Mail, ArrowLeft, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '../components/common/Button';
import { AuthService, defaultAuthService } from '../services/AuthService';

export interface ForgotPasswordScreenProps {
  authService?: AuthService;
  onNavigateSignIn: () => void;
}

export const ForgotPasswordScreen: React.FC<ForgotPasswordScreenProps> = ({
  authService = defaultAuthService,
  onNavigateSignIn,
}) => {
  const [identifier, setIdentifier] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isIdentifierValid = AuthService.isValidIdentifier(identifier);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isIdentifierValid || isLoading) return;

    setErrorMessage(null);
    setIsLoading(true);

    try {
      const result = await authService.forgotPassword(identifier.trim());
      if (result.success) {
        setIsSuccess(true);
        setSuccessMessage(result.message || 'Password reset instructions have been prepared.');
      } else {
        setErrorMessage(result.error || 'Failed to process request. Please try again.');
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
        {/* Top Back Navigation */}
        <div className="w-full flex items-center mb-4">
          <button
            type="button"
            onClick={onNavigateSignIn}
            className="p-2 -ml-2 rounded-xl text-content-secondary hover:bg-slate-100 min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer transition-colors"
            aria-label="Back to Sign In"
          >
            <ArrowLeft className="w-5 h-5 text-slate-700" />
          </button>
        </div>

        {/* Official Company Logo */}
        <div className="flex flex-col items-center mb-4">
          <div className="w-16 h-16 sm:w-20 sm:h-20 mb-2 flex items-center justify-center">
            <img
              src="/assets/images/aisteth_logo.png"
              alt="AiSteth Official Logo"
              className="w-full h-full object-contain drop-shadow-xs"
            />
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-brand-900 tracking-tight text-center">
            AiSteth Academy
          </h1>
        </div>

        {/* Title */}
        <div className="w-full text-left mb-4">
          <h2 className="text-base sm:text-lg font-bold text-content-primary">
            Reset Password
          </h2>
          <p className="text-xs sm:text-sm text-content-secondary mt-0.5 leading-relaxed">
            Enter your registered email address or mobile phone number to recover your account.
          </p>
        </div>

        {/* Success State */}
        {isSuccess ? (
          <div className="w-full space-y-4 my-2">
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-2">
              <div className="flex items-center gap-2 text-emerald-700">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  Request Received
                </span>
              </div>
              <p className="text-xs text-emerald-800 leading-relaxed">
                {successMessage}
              </p>
            </div>

            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={onNavigateSignIn}
              className="py-3 text-sm font-bold min-h-[48px]"
            >
              BACK TO SIGN IN
            </Button>
          </div>
        ) : (
          /* Reset Form */
          <form onSubmit={handleSubmit} className="w-full space-y-4" noValidate>
            {errorMessage && (
              <div
                role="alert"
                className="w-full p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="leading-snug">{errorMessage}</span>
              </div>
            )}

            <div>
              <label
                htmlFor="forgot-identifier"
                className="block text-xs font-bold text-content-primary mb-1"
              >
                Email or Phone Number <span className="text-rose-500">*</span>
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-3 text-slate-400 pointer-events-none">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="forgot-identifier"
                  type="text"
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="e.g. name@health.gov.in or 9876543210"
                  className="w-full pl-9 pr-3.5 py-2.5 sm:py-3 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm text-content-primary placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-brand-500 font-medium"
                  aria-required="true"
                  disabled={isLoading}
                />
              </div>
              {identifier.length > 0 && !isIdentifierValid && (
                <p className="text-[11px] text-amber-600 font-medium mt-1">
                  Please enter a valid email address or 10-digit phone number.
                </p>
              )}
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              disabled={!isIdentifierValid || isLoading}
              className="py-3 sm:py-3.5 text-sm font-bold min-h-[48px] shadow-sm flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Sending Request...</span>
                </>
              ) : (
                'SEND RECOVERY INSTRUCTIONS'
              )}
            </Button>
          </form>
        )}
      </div>

      {/* Footer Return */}
      <div className="w-full max-w-sm mx-auto text-center pt-5 pb-2 border-t border-slate-100 mt-4">
        <button
          type="button"
          onClick={onNavigateSignIn}
          className="text-xs font-bold text-brand-600 hover:text-brand-800 hover:underline p-1 cursor-pointer transition-colors"
        >
          ← Return to Sign In
        </button>
      </div>
    </div>
  );
};
