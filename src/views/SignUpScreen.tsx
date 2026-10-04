import React, { useState } from 'react';
import { Eye, EyeOff, Lock, User, Building2, Mail, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '../components/common/Button';
import { AuthService, defaultAuthService } from '../services/AuthService';
import { UserProfile } from '../models/user.types';
import { INDIAN_STATES_AND_UTS, getDistrictsForState } from '../data/indiaLocations';

export interface SignUpScreenProps {
  authService?: AuthService;
  onSuccess: (profile: UserProfile) => void;
  onNavigateSignIn: () => void;
}

export const SignUpScreen: React.FC<SignUpScreenProps> = ({
  authService = defaultAuthService,
  onSuccess,
  onNavigateSignIn,
}) => {
  const [name, setName] = useState('');
  const [role, setRole] = useState<'ASHA_WORKER' | 'ANGANWADI_WORKER' | 'HEALTH_VOLUNTEER'>('ASHA_WORKER');
  const [healthSubCentre, setHealthSubCentre] = useState('');
  const [state, setState] = useState('');
  const [district, setDistrict] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Get available districts based on selected state
  const availableDistricts = getDistrictsForState(state);

  // Field validations
  const isNameValid = name.trim().length >= 2;
  const isCentreValid = healthSubCentre.trim().length >= 2;
  const isStateValid = state.trim().length > 0;
  const isDistrictValid = district.trim().length > 0;
  const isIdentifierValid = AuthService.isValidIdentifier(identifier);
  const isPasswordValid = password.length >= 6;
  const isConfirmPasswordMatch = password.length > 0 && password === confirmPassword;

  const isFormValid =
    isNameValid &&
    isCentreValid &&
    isStateValid &&
    isDistrictValid &&
    isIdentifierValid &&
    isPasswordValid &&
    isConfirmPasswordMatch;

  // Handle State selection change and reset dependent District
  const handleStateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedState = e.target.value;
    setState(selectedState);
    setDistrict(''); // Reset district when state changes
    if (errorMessage) setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || isLoading) return;

    setErrorMessage(null);
    setIsLoading(true);

    try {
      const result = await authService.signUp({
        name: name.trim(),
        role: role,
        healthSubCentre: healthSubCentre.trim(),
        district: district.trim(),
        state: state.trim(),
        identifier: identifier.trim(),
        password: password,
      });

      if (result.success && result.profile) {
        onSuccess(result.profile);
      } else {
        setErrorMessage(result.error || 'Unable to create account. Please check your details.');
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
        <div className="flex flex-col items-center mb-3 sm:mb-4">
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
            Create your account
          </h2>
          <p className="text-xs sm:text-sm text-content-secondary mt-0.5">
            Start your frontline clinical auscultation training
          </p>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div
            role="alert"
            className="w-full mb-3.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2 animate-in fade-in"
          >
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span className="leading-snug">{errorMessage}</span>
          </div>
        )}

        {/* Sign Up Form */}
        <form onSubmit={handleSubmit} className="w-full space-y-3" noValidate>
          {/* Full Name */}
          <div>
            <label
              htmlFor="signup-name"
              className="block text-xs font-bold text-content-primary mb-1"
            >
              Full Name <span className="text-rose-500">*</span>
            </label>
            <div className="relative flex items-center">
              <div className="absolute left-3 text-slate-400 pointer-events-none">
                <User className="w-4 h-4" />
              </div>
              <input
                id="signup-name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="e.g. Sunita Sharma"
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm text-content-primary placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-brand-500 font-medium"
                aria-required="true"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Role Selection */}
          <div>
            <label
              htmlFor="signup-role"
              className="block text-xs font-bold text-content-primary mb-1"
            >
              Role <span className="text-rose-500">*</span>
            </label>
            <select
              id="signup-role"
              value={role}
              onChange={(e) => setRole(e.target.value as 'ASHA_WORKER' | 'ANGANWADI_WORKER' | 'HEALTH_VOLUNTEER')}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm text-content-primary font-medium focus:outline-hidden focus:ring-2 focus:ring-brand-500 cursor-pointer min-h-[44px]"
              disabled={isLoading}
            >
              <option value="ASHA_WORKER">ASHA Health Worker</option>
              <option value="ANGANWADI_WORKER">Anganwadi Worker</option>
              <option value="HEALTH_VOLUNTEER">Health Volunteer</option>
            </select>
          </div>

          {/* Health Centre */}
          <div>
            <label
              htmlFor="signup-centre"
              className="block text-xs font-bold text-content-primary mb-1"
            >
              Health Centre / Sub-Centre <span className="text-rose-500">*</span>
            </label>
            <div className="relative flex items-center">
              <div className="absolute left-3 text-slate-400 pointer-events-none">
                <Building2 className="w-4 h-4" />
              </div>
              <input
                id="signup-centre"
                type="text"
                value={healthSubCentre}
                onChange={(e) => setHealthSubCentre(e.target.value)}
                placeholder="e.g. Ramnagar Sub-Centre"
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm text-content-primary placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-brand-500 font-medium"
                aria-required="true"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* State & District Dependent Dropdowns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* State Selection */}
            <div>
              <label
                htmlFor="signup-state"
                className="block text-xs font-bold text-content-primary mb-1"
              >
                State <span className="text-rose-500">*</span>
              </label>
              <div className="relative flex items-center">
                <select
                  id="signup-state"
                  value={state}
                  onChange={handleStateChange}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm text-content-primary font-medium focus:outline-hidden focus:ring-2 focus:ring-brand-500 cursor-pointer min-h-[44px]"
                  aria-required="true"
                  disabled={isLoading}
                >
                  <option value="">Select state</option>
                  {INDIAN_STATES_AND_UTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* District Selection (Dependent on State) */}
            <div>
              <label
                htmlFor="signup-district"
                className="block text-xs font-bold text-content-primary mb-1"
              >
                District <span className="text-rose-500">*</span>
              </label>
              <div className="relative flex items-center">
                <select
                  id="signup-district"
                  value={district}
                  onChange={(e) => {
                    setDistrict(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  disabled={!state || availableDistricts.length === 0 || isLoading}
                  className={`w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-brand-500 min-h-[44px] ${
                    !state
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-slate-200'
                      : 'bg-white text-content-primary cursor-pointer'
                  }`}
                  aria-required="true"
                  aria-disabled={!state || availableDistricts.length === 0 || isLoading}
                >
                  <option value="">
                    {state ? 'Select district' : 'Select state first'}
                  </option>
                  {availableDistricts.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Email / Phone */}
          <div>
            <label
              htmlFor="signup-identifier"
              className="block text-xs font-bold text-content-primary mb-1"
            >
              Email or Phone Number <span className="text-rose-500">*</span>
            </label>
            <div className="relative flex items-center">
              <div className="absolute left-3 text-slate-400 pointer-events-none">
                <Mail className="w-4 h-4" />
              </div>
              <input
                id="signup-identifier"
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="e.g. 9876543210 or name@health.gov.in"
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm text-content-primary placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-brand-500 font-medium"
                aria-required="true"
                disabled={isLoading}
              />
            </div>
            {identifier.length > 0 && !isIdentifierValid && (
              <p className="text-[11px] text-amber-600 font-medium mt-1">
                Enter a valid email or 10-digit mobile number.
              </p>
            )}
          </div>

          {/* Password */}
          <div>
            <label
              htmlFor="signup-password"
              className="block text-xs font-bold text-content-primary mb-1"
            >
              Password <span className="text-rose-500">*</span>
            </label>
            <div className="relative flex items-center">
              <div className="absolute left-3 text-slate-400 pointer-events-none">
                <Lock className="w-4 h-4" />
              </div>
              <input
                id="signup-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm text-content-primary placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-brand-500 font-medium"
                aria-required="true"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 min-w-[36px] min-h-[36px] flex items-center justify-center cursor-pointer transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label
              htmlFor="signup-confirm-password"
              className="block text-xs font-bold text-content-primary mb-1"
            >
              Confirm Password <span className="text-rose-500">*</span>
            </label>
            <div className="relative flex items-center">
              <div className="absolute left-3 text-slate-400 pointer-events-none">
                <Lock className="w-4 h-4" />
              </div>
              <input
                id="signup-confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm text-content-primary placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-brand-500 font-medium"
                aria-required="true"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-2.5 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 min-w-[36px] min-h-[36px] flex items-center justify-center cursor-pointer transition-colors"
                aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {confirmPassword.length > 0 && !isConfirmPasswordMatch && (
              <p className="text-[11px] text-rose-600 font-medium mt-1">
                Passwords do not match.
              </p>
            )}
          </div>

          {/* Submit Button */}
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
                  <span>Creating Account...</span>
                </>
              ) : (
                'CREATE ACCOUNT'
              )}
            </Button>
          </div>
        </form>
      </div>

      {/* Footer Navigation */}
      <div className="w-full max-w-sm mx-auto text-center pt-5 pb-2 border-t border-slate-100 mt-4">
        <p className="text-xs text-content-secondary">
          Already have an account?{' '}
          <button
            type="button"
            onClick={onNavigateSignIn}
            className="font-bold text-brand-600 hover:text-brand-800 hover:underline p-1 cursor-pointer transition-colors"
          >
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
};
