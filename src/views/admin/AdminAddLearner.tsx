import React, { useState } from 'react';
import {
  UserPlus,
  Phone,
  User,
  Briefcase,
  Lock,
  Building,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  RefreshCw,
  ArrowLeft
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { SingleLearnerInput, LearnerSummaryItem } from '../../models/admin.types';
import { adminApi } from '../../api/adminApi';

interface AdminAddLearnerProps {
  onLearnerCreated?: (learner: LearnerSummaryItem) => void;
  onNavigateBack?: () => void;
}

const DESIGNATION_OPTIONS = [
  { value: 'ASHA_WORKER', label: 'ASHA Worker' },
  { value: 'ANGANWADI_WORKER', label: 'Anganwadi Worker' },
  { value: 'ANM', label: 'Auxiliary Nurse Midwife (ANM)' },
  { value: 'CHO', label: 'Community Health Officer (CHO)' },
  { value: 'HEALTH_VOLUNTEER', label: 'Health Volunteer' },
  { value: 'RBSK_MO', label: 'RBSK Medical Officer' },
];

export const AdminAddLearner: React.FC<AdminAddLearnerProps> = ({
  onLearnerCreated,
  onNavigateBack,
}) => {
  const [formData, setFormData] = useState<SingleLearnerInput>({
    displayName: '',
    phoneNumber: '',
    designation: 'ASHA_WORKER',
    healthSubCentre: '',
    username: '',
    optionalEmail: '',
    password: '',
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [createdLearner, setCreatedLearner] = useState<LearnerSummaryItem | null>(null);
  const [isTriggeringWA, setIsTriggeringWA] = useState(false);
  const [waMessage, setWaMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.displayName.trim()) {
      errors.displayName = 'Full name is required.';
    }

    const cleanPhone = formData.phoneNumber.replace(/[\s\-\(\)\.]/g, '');
    if (!cleanPhone) {
      errors.phoneNumber = 'Phone number is required.';
    } else if (!/^(?:\+91|91)?[6-9]\d{9}$/.test(cleanPhone)) {
      errors.phoneNumber = 'Enter a valid 10-digit Indian mobile number (e.g. 9876543210).';
    }

    if (!formData.designation.trim()) {
      errors.designation = 'Designation is required.';
    }

    if (formData.username && formData.username.trim()) {
      const u = formData.username.trim().toLowerCase();
      if (u.length < 3 || u.length > 30) {
        errors.username = 'Username must be between 3 and 30 characters.';
      } else if (!/^[a-z0-9._-]+$/.test(u)) {
        errors.username = 'Only letters, numbers, dots, hyphens, and underscores allowed.';
      }
    }

    if (formData.password && formData.password.trim() && formData.password.trim().length < 6) {
      errors.password = 'Password must be at least 6 characters.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);
    setCreatedLearner(null);
    setWaMessage(null);

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await adminApi.registerSingleLearner({
        displayName: formData.displayName.trim(),
        phoneNumber: formData.phoneNumber.trim(),
        designation: formData.designation.trim(),
        healthSubCentre: formData.healthSubCentre?.trim() || undefined,
        username: formData.username?.trim() || undefined,
        optionalEmail: formData.optionalEmail?.trim() || undefined,
        password: formData.password?.trim() || undefined,
      });

      if (res.success && res.learner) {
        setCreatedLearner(res.learner);
        onLearnerCreated?.(res.learner);
        // Reset form for next entry
        setFormData({
          displayName: '',
          phoneNumber: '',
          designation: 'ASHA_WORKER',
          healthSubCentre: '',
          username: '',
          optionalEmail: '',
          password: '',
        });
      }
    } catch (err: any) {
      setGeneralError(err?.message || 'Failed to register learner. Please verify details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendWhatsApp = async () => {
    if (!createdLearner) return;
    setIsTriggeringWA(true);
    setWaMessage(null);
    try {
      const res = await adminApi.triggerWhatsAppOnboarding(createdLearner.uid);
      if (res.success) {
        if (res.result.status === 'SENT' || res.result.status === 'DELIVERED') {
          setWaMessage({ type: 'success', text: 'WhatsApp invitation sent successfully!' });
        } else {
          setWaMessage({
            type: 'error',
            text: res.result.error || 'WhatsApp message could not be delivered. Check server configuration.',
          });
        }
      }
    } catch (err: any) {
      setWaMessage({ type: 'error', text: err?.message || 'Failed to dispatch message.' });
    } finally {
      setIsTriggeringWA(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-150">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-brand-600" />
            <span>Register New Learner</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Create an individual trainee account in the centralized RBSK learning engine.
          </p>
        </div>
        {onNavigateBack && (
          <Button variant="ghost" size="sm" onClick={onNavigateBack} icon={<ArrowLeft className="w-4 h-4" />}>
            Back
          </Button>
        )}
      </div>

      {/* Success Banner */}
      {createdLearner && (
        <div className="p-5 bg-emerald-50/80 border border-emerald-200 rounded-2xl space-y-3">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-bold text-emerald-950 text-sm">Learner Registered Successfully!</h3>
              <p className="text-xs text-emerald-800 mt-0.5">
                Account created for <strong>{createdLearner.displayName}</strong> (@{createdLearner.username}). Phone: {createdLearner.phoneNumber}.
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-emerald-200/60 flex items-center justify-between gap-3 flex-wrap">
            <span className="text-xs text-emerald-700 font-medium">Next step: Initiate WhatsApp welcome message</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSendWhatsApp}
              disabled={isTriggeringWA}
              icon={
                isTriggeringWA ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <MessageSquare className="w-3.5 h-3.5 text-emerald-700" />
                )
              }
              className="bg-white border-emerald-300 text-emerald-900 hover:bg-emerald-50"
            >
              {isTriggeringWA ? 'Sending...' : 'Send WhatsApp Invite Now'}
            </Button>
          </div>

          {waMessage && (
            <div
              className={`p-2.5 rounded-xl text-xs font-medium ${
                waMessage.type === 'success' ? 'bg-emerald-100 text-emerald-900' : 'bg-rose-100 text-rose-900'
              }`}
            >
              {waMessage.text}
            </div>
          )}
        </div>
      )}

      {/* Error Banner */}
      {generalError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-xs text-rose-800">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <span>{generalError}</span>
        </div>
      )}

      {/* Registration Form */}
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-5">
        {/* Full Name & Phone Number */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Full Name <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                placeholder="e.g. Priya Sharma"
                className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl border text-sm outline-hidden transition-all ${
                  fieldErrors.displayName ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20'
                }`}
              />
            </div>
            {fieldErrors.displayName && <p className="text-xs text-rose-600 mt-1">{fieldErrors.displayName}</p>}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Phone Number (WhatsApp) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={formData.phoneNumber}
                onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                placeholder="10-digit mobile number"
                className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl border text-sm outline-hidden transition-all ${
                  fieldErrors.phoneNumber ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20'
                }`}
              />
            </div>
            {fieldErrors.phoneNumber && <p className="text-xs text-rose-600 mt-1">{fieldErrors.phoneNumber}</p>}
          </div>
        </div>

        {/* Designation */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            Designation / Role <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <Briefcase className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <select
              value={formData.designation}
              onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
              className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-hidden focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            >
              {DESIGNATION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>



        {/* Health Sub Centre (Optional) */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            Health Sub Centre / Facility <span className="text-slate-400 font-normal">(Optional)</span>
          </label>
          <div className="relative">
            <Building className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={formData.healthSubCentre}
              onChange={(e) => setFormData({ ...formData, healthSubCentre: e.target.value })}
              placeholder="e.g. Shirur Primary Health Centre"
              className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm outline-hidden focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            />
          </div>
        </div>

        {/* Optional Credentials Override Accordion */}
        <div className="pt-2 border-t border-slate-100">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-3">
            Account Credentials (Optional)
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Custom Username <span className="text-slate-400 font-normal">(Auto-generated if empty)</span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="trainee_<phone>"
                  className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl border text-sm outline-hidden transition-all ${
                    fieldErrors.username ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200 focus:border-brand-500'
                  }`}
                />
              </div>
              {fieldErrors.username && <p className="text-xs text-rose-600 mt-1">{fieldErrors.username}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Initial Password <span className="text-slate-400 font-normal">(Auto-generated if empty)</span>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Welcome@<last4>"
                  className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl border text-sm outline-hidden transition-all ${
                    fieldErrors.password ? 'border-rose-400 bg-rose-50/30' : 'border-slate-200 focus:border-brand-500'
                  }`}
                />
              </div>
              {fieldErrors.password && <p className="text-xs text-rose-600 mt-1">{fieldErrors.password}</p>}
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-2 flex justify-end">
          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={isSubmitting}
            icon={isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
          >
            {isSubmitting ? 'Registering Learner...' : 'Register Learner'}
          </Button>
        </div>
      </form>
    </div>
  );
};
