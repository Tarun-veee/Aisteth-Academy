import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  Users,
  MessageSquare,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Eye,
  CheckCircle2,
  AlertCircle,
  Clock,
  Zap,
  Flame,
  ShieldCheck,
  ShieldAlert
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { LearnerSummaryItem, OnboardingStatus, AccountStatus } from '../../models/admin.types';
import { adminApi } from '../../api/adminApi';
import { LearnerDetailModal } from './LearnerDetailModal';

export const AdminLearnerList: React.FC = () => {
  const [learners, setLearners] = useState<LearnerSummaryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit] = useState(15);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<OnboardingStatus | 'ALL'>('ALL');
  const [accountStatusFilter, setAccountStatusFilter] = useState<AccountStatus | 'ALL'>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selection for bulk WhatsApp action
  const [selectedUids, setSelectedUids] = useState<Set<string>>(new Set());
  const [isBulkDispatching, setIsBulkDispatching] = useState(false);
  const [bulkFeedback, setBulkFeedback] = useState<string | null>(null);

  // Inspection modal
  const [selectedLearner, setSelectedLearner] = useState<LearnerSummaryItem | null>(null);

  // Debounce search input by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1); // Reset to page 1 on search
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchLearners = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await adminApi.listLearners({
        page,
        limit,
        search: debouncedSearch,
        status: statusFilter,
        accountStatus: accountStatusFilter,
      });

      if (res && Array.isArray(res.learners)) {
        setLearners(res.learners);
        setTotal(res.total);
        setTotalPages(res.totalPages);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load learners.');
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, debouncedSearch, statusFilter, accountStatusFilter]);

  useEffect(() => {
    fetchLearners();
  }, [fetchLearners]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedUids(new Set(learners.map((l) => l.uid)));
    } else {
      setSelectedUids(new Set());
    }
  };

  const handleToggleSelect = (uid: string) => {
    const next = new Set(selectedUids);
    if (next.has(uid)) {
      next.delete(uid);
    } else {
      next.add(uid);
    }
    setSelectedUids(next);
  };

  const handleBulkWhatsAppOnboard = async () => {
    if (selectedUids.size === 0) return;
    setIsBulkDispatching(true);
    setBulkFeedback(null);
    try {
      const uids = Array.from(selectedUids);
      const res = await adminApi.bulkTriggerWhatsAppOnboarding(uids);
      setBulkFeedback(
        `Batch processed: ${res.sentCount} sent successfully, ${res.failedCount} failed or queued.`
      );
      setSelectedUids(new Set());
      fetchLearners();
    } catch (err: any) {
      setBulkFeedback(err?.message || 'Bulk WhatsApp trigger failed.');
    } finally {
      setIsBulkDispatching(false);
    }
  };

  const getStatusBadge = (status: OnboardingStatus) => {
    switch (status) {
      case 'DELIVERED':
      case 'SENT':
        return <Badge variant="success" icon={<CheckCircle2 className="w-3 h-3" />}>Delivered</Badge>;
      case 'QUEUED':
        return <Badge variant="warning" icon={<Clock className="w-3 h-3" />}>Queued</Badge>;
      case 'FAILED':
        return <Badge variant="error" icon={<AlertCircle className="w-3 h-3" />}>Failed</Badge>;
      default:
        return <Badge variant="neutral" icon={<Clock className="w-3 h-3" />}>Not Initiated</Badge>;
    }
  };

  const getAccountStatusBadge = (status?: AccountStatus) => {
    if (status === 'DEACTIVATED') {
      return (
        <Badge variant="error" icon={<ShieldAlert className="w-3 h-3" />}>
          Deactivated
        </Badge>
      );
    }
    return (
      <Badge variant="success" icon={<ShieldCheck className="w-3 h-3" />}>
        Active
      </Badge>
    );
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      {/* Top Controls Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, username, or phone..."
            className="w-full pl-10 pr-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs outline-hidden focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
          />
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Account Status Filter */}
          <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600 shrink-0">
            {(['ALL', 'ACTIVE', 'DEACTIVATED'] as const).map((st) => (
              <button
                key={st}
                onClick={() => {
                  setAccountStatusFilter(st);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  accountStatusFilter === st ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'hover:text-slate-900'
                }`}
              >
                {st === 'ALL' ? 'All Status' : st === 'ACTIVE' ? 'Active' : 'Deactivated'}
              </button>
            ))}
          </div>

          {/* Onboarding Delivery Status Filter */}
          <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600 shrink-0">
            {(['ALL', 'NOT_INITIATED', 'SENT', 'FAILED'] as const).map((st) => (
              <button
                key={st}
                onClick={() => {
                  setStatusFilter(st);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  statusFilter === st ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'hover:text-slate-900'
                }`}
              >
                {st === 'ALL'
                  ? 'All Invites'
                  : st === 'NOT_INITIATED'
                  ? 'Not Sent'
                  : st === 'SENT'
                  ? 'Delivered'
                  : 'Failed'}
              </button>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchLearners}
            disabled={isLoading}
            icon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
            className="shrink-0"
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Bulk Action Strip (When rows selected) */}
      {selectedUids.size > 0 && (
        <div className="p-3 bg-brand-50 border border-brand-200 rounded-xl flex items-center justify-between text-xs animate-in fade-in">
          <span className="font-semibold text-brand-900">
            {selectedUids.size} learner{selectedUids.size > 1 ? 's' : ''} selected
          </span>
          <Button
            variant="primary"
            size="sm"
            onClick={handleBulkWhatsAppOnboard}
            disabled={isBulkDispatching}
            icon={
              isBulkDispatching ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <MessageSquare className="w-3.5 h-3.5" />
              )
            }
          >
            {isBulkDispatching ? 'Dispatching...' : `Send WhatsApp Invite (${selectedUids.size})`}
          </Button>
        </div>
      )}

      {/* Bulk Action Feedback Message */}
      {bulkFeedback && (
        <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 text-slate-800 text-xs flex items-center justify-between">
          <span>{bulkFeedback}</span>
          <button onClick={() => setBulkFeedback(null)} className="text-slate-500 hover:text-slate-800 font-bold ml-2">
            Dismiss
          </button>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <Button variant="outline" size="sm" onClick={fetchLearners}>
            Retry
          </Button>
        </div>
      )}

      {/* Learners Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-100">
              <tr>
                <th className="py-3 px-3.5 w-10">
                  <input
                    type="checkbox"
                    checked={learners.length > 0 && selectedUids.size === learners.length}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                </th>
                <th className="py-3 px-3.5">Learner</th>
                <th className="py-3 px-3.5">Account Status</th>
                <th className="py-3 px-3.5">Phone Number</th>
                <th className="py-3 px-3.5">Designation</th>
                <th className="py-3 px-3.5">Facility / Sub-Centre</th>
                <th className="py-3 px-3.5">Progress</th>
                <th className="py-3 px-3.5">WhatsApp Invite</th>
                <th className="py-3 px-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-brand-600" />
                    <span>Loading learner directory...</span>
                  </td>
                </tr>
              ) : learners.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="font-semibold text-slate-600 text-sm">No learners found</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {searchTerm ? 'Try adjusting your search criteria.' : 'Register new learners to populate directory.'}
                    </p>
                  </td>
                </tr>
              ) : (
                learners.map((learner) => {
                  const isChecked = selectedUids.has(learner.uid);
                  return (
                    <tr key={learner.uid} className={`hover:bg-slate-50/60 transition-colors ${isChecked ? 'bg-brand-50/30' : ''}`}>
                      <td className="py-3 px-3.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleSelect(learner.uid)}
                          className="rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                        />
                      </td>
                      <td className="py-3 px-3.5">
                        <div className="font-bold text-slate-900">{learner.displayName}</div>
                        <div className="text-[11px] font-mono text-slate-400">@{learner.username}</div>
                      </td>
                      <td className="py-3 px-3.5">
                        {getAccountStatusBadge(learner.accountStatus)}
                      </td>
                      <td className="py-3 px-3.5 font-mono text-slate-700">
                        {learner.phoneNumber || <span className="text-slate-400 italic">None</span>}
                      </td>
                      <td className="py-3 px-3.5 font-medium text-slate-700">
                        {learner.designation || 'ASHA_WORKER'}
                      </td>
                      <td className="py-3 px-3.5 text-slate-600">
                        {learner.healthSubCentre || <span className="text-slate-400 italic">None</span>}
                      </td>
                      <td className="py-3 px-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 font-semibold text-brand-700 bg-brand-50 px-2 py-0.5 rounded-md text-[11px]">
                            <Zap className="w-3 h-3" /> {learner.totalXp} XP
                          </span>
                          <span className="inline-flex items-center gap-1 font-semibold text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded-md text-[11px]">
                            <Flame className="w-3 h-3" /> {learner.currentStreak}d
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3.5">
                        {getStatusBadge(learner.onboardingStatus)}
                      </td>
                      <td className="py-3 px-3.5 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedLearner(learner)}
                          icon={<Eye className="w-3.5 h-3.5 text-slate-600" />}
                          className="px-2.5 py-1 text-xs"
                        >
                          Manage
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between text-xs bg-slate-50/50">
          <span className="text-slate-500">
            Showing <strong>{learners.length}</strong> of <strong>{total}</strong> learners
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isLoading}
              icon={<ChevronLeft className="w-3.5 h-3.5" />}
              className="px-2.5 py-1"
            >
              Previous
            </Button>
            <span className="text-slate-700 font-semibold px-2">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isLoading}
              icon={<ChevronRight className="w-3.5 h-3.5" />}
              iconPosition="right"
              className="px-2.5 py-1"
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      {/* Learner Detail Modal */}
      {selectedLearner && (
        <LearnerDetailModal
          learner={selectedLearner}
          onClose={() => setSelectedLearner(null)}
          onLearnerUpdated={(updated) => {
            setLearners((prev) => prev.map((l) => (l.uid === updated.uid ? updated : l)));
            setSelectedLearner(updated);
          }}
        />
      )}
    </div>
  );
};
