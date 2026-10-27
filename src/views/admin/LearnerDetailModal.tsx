import React, { useState } from 'react';
import {
  X,
  User,
  Phone,
  MapPin,
  Briefcase,
  Flame,
  Award,
  Zap,
  Calendar,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Edit2,
  KeyRound,
  Copy,
  Check,
  ShieldAlert,
  ShieldCheck,
  Save
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import {
  LearnerSummaryItem,
  OnboardingStatus,
  AccountStatus,
  ResetCredentialsResult
} from '../../models/admin.types';
import { adminApi } from '../../api/adminApi';

interface LearnerDetailModalProps {
  learner: LearnerSummaryItem;
  onClose: () => void;
  onLearnerUpdated?: (updated: LearnerSummaryItem) => void;
}

const DESIGNATION_OPTIONS = [
  { value: 'ASHA_WORKER', label: 'ASHA Worker' },
  { value: 'ANGANWADI_WORKER', label: 'Anganwadi Worker' },
  { value: 'ANM', label: 'Auxiliary Nurse Midwife (ANM)' },
  { value: 'CHO', label: 'Community Health Officer (CHO)' },
  { value: 'HEALTH_VOLUNTEER', label: 'Health Volunteer' },
  { value: 'RBSK_MO', label: 'RBSK Medical Officer' },
];

export const LearnerDetailModal: React.FC<LearnerDetailModalProps> = ({
  learner,
  onClose,
  onLearnerUpdated,
}) => {
  const [currentLearner, setCurrentLearner] = useState<LearnerSummaryItem>(learner);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isStatusToggling, setIsStatusToggling] = useState(false);
  const [isResettingCreds, setIsResettingCreds] = useState(false);
  const [isTriggeringWA, setIsTriggeringWA] = useState(false);
  const [copiedInstructions, setCopiedInstructions] = useState(false);
  const [generatedCreds, setGeneratedCreds] = useState<ResetCredentialsResult | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Edit Form State
  const [editDisplayName, setEditDisplayName] = useState(learner.displayName);
  const [editPhoneNumber, setEditPhoneNumber] = useState(learner.phoneNumber || '');
  const [editDesignation, setEditDesignation] = useState(learner.designation || 'ASHA_WORKER');
  const [editHealthSubCentre, setEditHealthSubCentre] = useState(learner.healthSubCentre || '');

  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDisplayName.trim()) {
      setActionMessage({ type: 'error', text: 'Full name cannot be empty.' });
      return;
    }

    setIsSaving(true);
    setActionMessage(null);
    try {
      const res = await adminApi.updateLearner(currentLearner.uid, {
        displayName: editDisplayName.trim(),
        phoneNumber: editPhoneNumber.trim() || undefined,
        designation: editDesignation.trim(),
        healthSubCentre: editHealthSubCentre.trim() || undefined,
      });

      if (res.success && res.learner) {
        setCurrentLearner(res.learner);
        onLearnerUpdated?.(res.learner);
        setIsEditing(false);
        setActionMessage({ type: 'success', text: 'Worker details updated successfully!' });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err?.message || 'Failed to update worker details.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleAccountStatus = async () => {
    const newStatus: AccountStatus = currentLearner.accountStatus === 'DEACTIVATED' ? 'ACTIVE' : 'DEACTIVATED';
    const confirmPrompt =
      newStatus === 'DEACTIVATED'
        ? `Are you sure you want to deactivate ${currentLearner.displayName}'s account? They will be immediately blocked from signing into AuSkill.`
        : `Reactivate ${currentLearner.displayName}'s account?`;

    if (!window.confirm(confirmPrompt)) {
      return;
    }

    setIsStatusToggling(true);
    setActionMessage(null);
    try {
      const res = await adminApi.setLearnerStatus(currentLearner.uid, newStatus);
      if (res.success && res.learner) {
        setCurrentLearner(res.learner);
        onLearnerUpdated?.(res.learner);
        setActionMessage({
          type: 'success',
          text: `Account successfully ${newStatus === 'DEACTIVATED' ? 'deactivated' : 'reactivated'}.`,
        });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err?.message || 'Failed to update account status.' });
    } finally {
      setIsStatusToggling(false);
    }
  };

  const handleResetCredentials = async () => {
    if (!window.confirm(`Regenerate temporary credentials for ${currentLearner.displayName}? Existing sessions will be terminated.`)) {
      return;
    }

    setIsResettingCreds(true);
    setActionMessage(null);
    try {
      const res = await adminApi.resetLearnerCredentials(currentLearner.uid);
      if (res.success && res.result) {
        setGeneratedCreds(res.result);
        setActionMessage({
          type: 'success',
          text: 'Temporary credentials generated! Copy or share the access instructions below.',
        });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err?.message || 'Failed to regenerate credentials.' });
    } finally {
      setIsResettingCreds(false);
    }
  };

  const handleCopyInstructions = () => {
    if (!generatedCreds?.instructions) return;
    navigator.clipboard.writeText(generatedCreds.instructions);
    setCopiedInstructions(true);
    setTimeout(() => setCopiedInstructions(false), 2500);
  };

  const handleTriggerWhatsApp = async () => {
    setIsTriggeringWA(true);
    setActionMessage(null);
    try {
      const res = await adminApi.triggerWhatsAppOnboarding(currentLearner.uid);
      if (res.success) {
        const updated: LearnerSummaryItem = {
          ...currentLearner,
          onboardingStatus: res.result.status,
          whatsappOnboardedAt: res.result.sentAt || new Date().toISOString(),
          onboardingError: res.result.error || null,
        };
        setCurrentLearner(updated);
        onLearnerUpdated?.(updated);
        if (res.result.status === 'SENT' || res.result.status === 'DELIVERED') {
          setActionMessage({ type: 'success', text: 'WhatsApp onboarding invitation dispatched successfully!' });
        } else {
          setActionMessage({
            type: 'error',
            text: res.result.error || 'WhatsApp onboarding could not be delivered. Check server configuration.',
          });
        }
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err?.message || 'Failed to trigger WhatsApp onboarding.' });
    } finally {
      setIsTriggeringWA(false);
    }
  };

  const getStatusBadge = (status: OnboardingStatus) => {
    switch (status) {
      case 'DELIVERED':
      case 'SENT':
        return <Badge variant="success" icon={<CheckCircle2 className="w-3.5 h-3.5" />}>Delivered</Badge>;
      case 'QUEUED':
        return <Badge variant="warning" icon={<Clock className="w-3.5 h-3.5" />}>Queued</Badge>;
      case 'FAILED':
        return <Badge variant="error" icon={<AlertCircle className="w-3.5 h-3.5" />}>Failed</Badge>;
      default:
        return <Badge variant="neutral" icon={<Clock className="w-3.5 h-3.5" />}>Not Initiated</Badge>;
    }
  };

  const getAccountStatusBadge = (status?: AccountStatus) => {
    if (status === 'DEACTIVATED') {
      return <Badge variant="error" icon={<ShieldAlert className="w-3.5 h-3.5" />}>Deactivated</Badge>;
    }
    return <Badge variant="success" icon={<ShieldCheck className="w-3.5 h-3.5" />}>Active Account</Badge>;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg ${
              currentLearner.accountStatus === 'DEACTIVATED'
                ? 'bg-rose-100 text-rose-700'
                : 'bg-brand-50 text-brand-700'
            }`}>
              {currentLearner.displayName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">{currentLearner.displayName}</h2>
                {getAccountStatusBadge(currentLearner.accountStatus)}
              </div>
              <p className="text-xs text-slate-500 font-mono">@{currentLearner.username}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm">
          {actionMessage && (
            <div
              className={`p-3.5 rounded-xl border flex items-start gap-2.5 text-xs font-medium leading-relaxed animate-in fade-in ${
                actionMessage.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}
            >
              {actionMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              )}
              <span>{actionMessage.text}</span>
            </div>
          )}

          {/* Generated Temporary Credentials Banner */}
          {generatedCreds && (
            <div className="p-4 bg-emerald-50/80 border border-emerald-200 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4 text-emerald-700" />
                  <span>Temporary Credentials Ready</span>
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyInstructions}
                  icon={copiedInstructions ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  className="bg-white border-emerald-300 text-emerald-800 text-xs py-1"
                >
                  {copiedInstructions ? 'Copied!' : 'Copy Access Instructions'}
                </Button>
              </div>

              <div className="bg-white p-3 rounded-xl border border-emerald-100 font-mono text-xs space-y-1 text-slate-800 select-all">
                <div><strong>Login ID:</strong> {generatedCreds.phoneNumber || generatedCreds.username}</div>
                <div><strong>Temporary Password:</strong> <span className="bg-amber-100 px-1.5 py-0.5 rounded text-amber-900 font-bold">{generatedCreds.temporaryPassword}</span></div>
                <div><strong>Portal:</strong> {generatedCreds.loginUrl}</div>
              </div>

              <p className="text-[11px] text-emerald-700">
                Share these instructions with the worker via SMS, WhatsApp, or official departmental channels.
              </p>
            </div>
          )}

          {/* Core Profile Card / Edit Mode */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Worker Profile & Deployment</h3>
              {!isEditing ? (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="text-xs font-semibold text-brand-600 hover:text-brand-800 flex items-center gap-1"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Edit Details</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                >
                  Cancel
                </button>
              )}
            </div>

            {isEditing ? (
              <form onSubmit={handleSaveDetails} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Full Name *</label>
                    <input
                      type="text"
                      value={editDisplayName}
                      onChange={(e) => setEditDisplayName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-brand-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Designation *</label>
                    <select
                      value={editDesignation}
                      onChange={(e) => setEditDesignation(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-brand-500"
                    >
                      {DESIGNATION_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Phone Number (10 Digits)</label>
                    <input
                      type="tel"
                      value={editPhoneNumber}
                      onChange={(e) => setEditPhoneNumber(e.target.value)}
                      placeholder="e.g. 9876543210"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-brand-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Health Sub Centre</label>
                    <input
                      type="text"
                      value={editHealthSubCentre}
                      onChange={(e) => setEditHealthSubCentre(e.target.value)}
                      placeholder="e.g. Rampur Sub Centre"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-brand-500"
                    />
                  </div>


                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                  <Button variant="outline" size="sm" type="button" onClick={() => setIsEditing(false)}>
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    type="submit"
                    disabled={isSaving}
                    icon={isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="flex items-center gap-2.5">
                  <Briefcase className="w-4 h-4 text-slate-400 shrink-0" />
                  <div>
                    <span className="text-[11px] text-slate-500 block">Designation</span>
                    <span className="font-semibold text-slate-800">{currentLearner.designation || 'Trainee'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                  <div>
                    <span className="text-[11px] text-slate-500 block">Phone Number</span>
                    <span className="font-semibold text-slate-800">{currentLearner.phoneNumber || 'Not provided'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                  <div>
                    <span className="text-[11px] text-slate-500 block">Health Sub Centre</span>
                    <span className="font-semibold text-slate-800">
                      {currentLearner.healthSubCentre || 'Not specified'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                  <div>
                    <span className="text-[11px] text-slate-500 block">Registered On</span>
                    <span className="font-semibold text-slate-800">
                      {new Date(currentLearner.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                </div>
                {currentLearner.healthSubCentre && (
                  <div className="flex items-center gap-2.5 sm:col-span-2">
                    <User className="w-4 h-4 text-slate-400 shrink-0" />
                    <div>
                      <span className="text-[11px] text-slate-500 block">Health Sub Centre</span>
                      <span className="font-semibold text-slate-800">{currentLearner.healthSubCentre}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Learning Engine Metrics */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              Learning Progress & Clinical Curriculum
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 bg-brand-50/60 rounded-xl border border-brand-100 flex flex-col items-center text-center">
                <Zap className="w-4 h-4 text-brand-600 mb-1" />
                <span className="text-[11px] text-brand-800 font-medium">Total XP</span>
                <span className="text-base font-bold text-brand-950 mt-0.5">{currentLearner.totalXp}</span>
              </div>
              <div className="p-3.5 bg-amber-50/60 rounded-xl border border-amber-100 flex flex-col items-center text-center">
                <Award className="w-4 h-4 text-amber-600 mb-1" />
                <span className="text-[11px] text-amber-800 font-medium">Current Level</span>
                <span className="text-base font-bold text-amber-950 mt-0.5">Level {currentLearner.currentLevel}</span>
              </div>
              <div className="p-3.5 bg-orange-50/60 rounded-xl border border-orange-100 flex flex-col items-center text-center">
                <Flame className="w-4 h-4 text-orange-600 mb-1" />
                <span className="text-[11px] text-orange-800 font-medium">Daily Streak</span>
                <span className="text-base font-bold text-orange-950 mt-0.5">{currentLearner.currentStreak} Days</span>
              </div>
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col items-center text-center">
                <CheckCircle2 className="w-4 h-4 text-slate-600 mb-1" />
                <span className="text-[11px] text-slate-700 font-medium">Completed</span>
                <span className="text-base font-bold text-slate-900 mt-0.5">{currentLearner.completedSessionsCount} Sessions</span>
              </div>
            </div>
          </div>

          {/* Administrative Security Actions */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              Security & Credential Operations
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Regenerate Credentials */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white flex flex-col justify-between space-y-2">
                <div>
                  <div className="flex items-center gap-2 font-semibold text-slate-800 text-xs">
                    <KeyRound className="w-4 h-4 text-amber-600" />
                    <span>Regenerate Access Password</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Issues a new temporary password for the worker and prepares standard access instructions.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetCredentials}
                  disabled={isResettingCreds}
                  icon={isResettingCreds ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
                  className="w-full text-xs justify-center"
                >
                  {isResettingCreds ? 'Regenerating...' : 'Regenerate Password'}
                </Button>
              </div>

              {/* Deactivate / Reactivate Account */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white flex flex-col justify-between space-y-2">
                <div>
                  <div className="flex items-center gap-2 font-semibold text-slate-800 text-xs">
                    {currentLearner.accountStatus === 'DEACTIVATED' ? (
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <ShieldAlert className="w-4 h-4 text-rose-600" />
                    )}
                    <span>
                      {currentLearner.accountStatus === 'DEACTIVATED' ? 'Reactivate Account' : 'Deactivate Account'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {currentLearner.accountStatus === 'DEACTIVATED'
                      ? 'Restore worker access to training missions.'
                      : 'Revoke active sessions and prevent worker from logging in.'}
                  </p>
                </div>
                <Button
                  variant={currentLearner.accountStatus === 'DEACTIVATED' ? 'primary' : 'danger'}
                  size="sm"
                  onClick={handleToggleAccountStatus}
                  disabled={isStatusToggling}
                  icon={isStatusToggling ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : undefined}
                  className="w-full text-xs justify-center"
                >
                  {isStatusToggling
                    ? 'Updating...'
                    : currentLearner.accountStatus === 'DEACTIVATED'
                    ? 'Activate Account'
                    : 'Deactivate Account'}
                </Button>
              </div>
            </div>
          </div>

          {/* WhatsApp Channel & Daily Reminders */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">WhatsApp Channel & Reminders</h3>
            <div className="p-4 rounded-xl border border-slate-200 bg-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-800">Delivery Status:</span>
                  {getStatusBadge(currentLearner.onboardingStatus)}
                </div>
                {currentLearner.whatsappOnboardedAt && (
                  <p className="text-xs text-slate-500 mt-1.5">
                    Last message sent: {new Date(currentLearner.whatsappOnboardedAt).toLocaleString('en-IN')}
                  </p>
                )}
                {currentLearner.onboardingError && (
                  <p className="text-xs text-rose-600 mt-1 font-mono">{currentLearner.onboardingError}</p>
                )}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleTriggerWhatsApp}
                disabled={isTriggeringWA || !currentLearner.phoneNumber || currentLearner.accountStatus === 'DEACTIVATED'}
                icon={
                  isTriggeringWA ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                  )
                }
              >
                {isTriggeringWA ? 'Sending...' : 'Send WhatsApp Invite'}
              </Button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};
