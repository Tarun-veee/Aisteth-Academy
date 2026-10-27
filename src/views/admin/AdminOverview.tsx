import React, { useEffect, useState } from 'react';
import {
  Users,
  Flame,
  Clock,
  AlertCircle,
  UserPlus,
  Upload,
  ArrowRight,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { AdminOverviewStats } from '../../models/admin.types';
import { adminApi } from '../../api/adminApi';

interface AdminOverviewProps {
  onNavigateTab: (tab: 'learners' | 'add' | 'bulk') => void;
}

export const AdminOverview: React.FC<AdminOverviewProps> = ({ onNavigateTab }) => {
  const [stats, setStats] = useState<AdminOverviewStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await adminApi.getOverview();
      if (res.success && res.stats) {
        setStats(res.stats);
      } else {
        setError('Failed to retrieve dashboard metrics.');
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to connect to administration service.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-brand-700 via-brand-600 to-brand-800 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 text-white text-xs font-semibold backdrop-blur-xs mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>RBSK Trainee Learning Engine</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Learner Onboarding & Administration</h1>
          <p className="mt-2 text-brand-100 text-sm leading-relaxed">
            Manage frontline healthcare trainees, register learners individually or in bulk, and initiate WhatsApp onboarding for clinical digital auscultation training.
          </p>
        </div>
      </div>

      {/* Error Notice */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <Button variant="outline" size="sm" onClick={loadStats} icon={<RefreshCw className="w-3 h-3" />}>
            Retry
          </Button>
        </div>
      )}

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Learners */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Total Registered</span>
            <div className="mt-1 text-2xl font-black text-slate-900">
              {isLoading ? (
                <div className="h-8 w-16 bg-slate-100 animate-pulse rounded-md" />
              ) : (
                stats?.totalLearners ?? 0
              )}
            </div>
            <span className="text-[11px] text-slate-400 mt-0.5 block">Shared 310-question curriculum</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Active Learners */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Active Trainees</span>
            <div className="mt-1 text-2xl font-black text-slate-900">
              {isLoading ? (
                <div className="h-8 w-16 bg-slate-100 animate-pulse rounded-md" />
              ) : (
                stats?.activeLearners ?? 0
              )}
            </div>
            <span className="text-[11px] text-emerald-600 font-medium mt-0.5 block">Active within last 7 days</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Flame className="w-6 h-6" />
          </div>
        </div>

        {/* Pending Onboarding */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Pending WhatsApp</span>
            <div className="mt-1 text-2xl font-black text-slate-900">
              {isLoading ? (
                <div className="h-8 w-16 bg-slate-100 animate-pulse rounded-md" />
              ) : (
                stats?.pendingOnboarding ?? 0
              )}
            </div>
            <span className="text-[11px] text-amber-600 font-medium mt-0.5 block">Awaiting invite dispatch</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* Failed Onboarding */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Failed Onboarding</span>
            <div className="mt-1 text-2xl font-black text-slate-900">
              {isLoading ? (
                <div className="h-8 w-16 bg-slate-100 animate-pulse rounded-md" />
              ) : (
                stats?.failedOnboarding ?? 0
              )}
            </div>
            <span className="text-[11px] text-rose-600 font-medium mt-0.5 block">Requires phone/config check</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <AlertCircle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Quick Action Shortcuts */}
      <div>
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">Onboarding Workflows</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div
            onClick={() => onNavigateTab('add')}
            className="p-5 bg-white rounded-2xl border border-slate-200/80 hover:border-brand-300 hover:shadow-sm cursor-pointer transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <UserPlus className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base group-hover:text-brand-600 transition-colors">
              Add Individual Learner
            </h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Register a single ASHA, Anganwadi, or frontline trainee with validated phone number.
            </p>
            <div className="mt-4 flex items-center text-xs font-bold text-brand-600 group-hover:translate-x-0.5 transition-transform">
              <span>Open Registration Form</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </div>
          </div>

          <div
            onClick={() => onNavigateTab('bulk')}
            className="p-5 bg-white rounded-2xl border border-slate-200/80 hover:border-brand-300 hover:shadow-sm cursor-pointer transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <Upload className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base group-hover:text-emerald-700 transition-colors">
              Bulk CSV Import
            </h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Upload a cohort of learners via CSV file with client-side preview, validation, and batch creation.
            </p>
            <div className="mt-4 flex items-center text-xs font-bold text-emerald-700 group-hover:translate-x-0.5 transition-transform">
              <span>Open CSV Import</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </div>
          </div>

          <div
            onClick={() => onNavigateTab('learners')}
            className="p-5 bg-white rounded-2xl border border-slate-200/80 hover:border-brand-300 hover:shadow-sm cursor-pointer transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base group-hover:text-blue-600 transition-colors">
              Learner Directory
            </h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Search by name or phone, inspect learning progress, and trigger WhatsApp onboarding.
            </p>
            <div className="mt-4 flex items-center text-xs font-bold text-blue-600 group-hover:translate-x-0.5 transition-transform">
              <span>View All Learners</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
