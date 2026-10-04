import React, { useState, useEffect } from 'react';
import { Header } from '../components/common/Header';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { UserProfile, DEFAULT_USER_PROFILE } from '../models/user.types';
import { UserStats } from '../models/session.types';
import {
  defaultStorageRepository,
  StorageRepository
} from '../repositories/StorageRepository';
import {
  User,
  MapPin,
  Building2,
  ChevronRight,
  LogOut
} from 'lucide-react';
import { INDIAN_STATES_AND_UTS, getDistrictsForState } from '../data/indiaLocations';

export interface ProfileScreenProps {
  userProfile?: UserProfile;
  userStats: UserStats;
  storageRepository?: StorageRepository;
  onBack: () => void;
  onEditProfile?: () => void;
  onSignOut?: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  userProfile: initialProfile,
  userStats,
  storageRepository = defaultStorageRepository,
  onBack,
  onEditProfile,
  onSignOut,
}) => {
  const [profile, setProfile] = useState<UserProfile>(initialProfile || DEFAULT_USER_PROFILE);
  const [isLoading, setIsLoading] = useState(!initialProfile);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<'ASHA_WORKER' | 'ANGANWADI_WORKER' | 'HEALTH_VOLUNTEER'>('ASHA_WORKER');
  const [editDistrict, setEditDistrict] = useState('');
  const [editState, setEditState] = useState('');
  const [editCenter, setEditCenter] = useState('');

  // Load user profile from storage if not provided in props
  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        if (!initialProfile) {
          const loadedProfile = await storageRepository.getUserProfile();
          if (isMounted) {
            setProfile(loadedProfile || DEFAULT_USER_PROFILE);
            setIsLoading(false);
          }
        } else {
          setProfile(initialProfile);
          setIsLoading(false);
        }
      } catch {
        if (isMounted) setIsLoading(false);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, [initialProfile, storageRepository]);

  // Helper for human-friendly role name
  const formatRoleDisplay = (role?: string): string => {
    if (!role) return 'ASHA Health Worker';
    if (role === 'ASHA_WORKER' || role === 'ASHA Health Worker') return 'ASHA Health Worker';
    if (role === 'ANGANWADI_WORKER' || role === 'Anganwadi Worker') return 'Anganwadi Worker';
    if (role === 'HEALTH_VOLUNTEER' || role === 'Health Volunteer') return 'Health Volunteer';
    return role;
  };

  const roleDisplay = formatRoleDisplay(profile.role);
  const locationDisplay = [profile.district, profile.state].filter(Boolean).join(', ') || 'Bengaluru, Karnataka';
  const subCentreDisplay = profile.healthSubCentre || profile.centerName || 'Health Sub-Centre';

  // Defensive values to prevent any NaN, null, or undefined displays
  const currentStreakCount = Math.max(0, userStats?.currentStreak || 0);
  const streakLabel = `${currentStreakCount} ${currentStreakCount === 1 ? 'Day' : 'Days'}`;
  const learningPointsCount = Math.max(0, userStats?.totalXp || 0);
  const lessonsCompletedCount = Math.max(0, userStats?.completedSessionsCount || 0);

  // Handle Edit Profile trigger (only inside profile card)
  const handleEditClick = () => {
    if (onEditProfile) {
      onEditProfile();
    } else {
      setEditName(profile.name || '');
      setEditRole((profile.role as 'ASHA_WORKER' | 'ANGANWADI_WORKER' | 'HEALTH_VOLUNTEER') || 'ASHA_WORKER');
      setEditDistrict(profile.district || '');
      setEditState(profile.state || '');
      setEditCenter(profile.healthSubCentre || profile.centerName || '');
      setIsEditing(true);
    }
  };

  const handleSaveProfile = async () => {
    const updated: UserProfile = {
      ...profile,
      name: editName.trim() || profile.name || 'Frontline Trainee',
      role: editRole,
      district: editDistrict.trim() || profile.district,
      state: editState.trim() || profile.state,
      healthSubCentre: editCenter.trim() || profile.healthSubCentre || profile.centerName,
      centerName: editCenter.trim() || profile.centerName,
    };
    setProfile(updated);
    setIsEditing(false);
    try {
      await storageRepository.saveUserProfile(updated);
    } catch (e) {
      console.warn('Failed to persist updated profile', e);
    }
  };

  // Handle Sign Out trigger
  const handleSignOutClick = () => {
    if (onSignOut) {
      onSignOut();
    } else {
      onBack();
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex flex-col overflow-y-auto min-h-0 bg-surface-bg select-none">
        <Header
          title="My Profile"
          showBack={true}
          onBack={onBack}
        />
        <main className="flex-1 p-3.5 sm:p-4 flex flex-col gap-3 max-w-md mx-auto w-full pb-4 animate-pulse">
          <div className="h-28 rounded-2xl bg-slate-200" />
          <div className="h-24 rounded-2xl bg-slate-200" />
          <div className="h-16 rounded-2xl bg-slate-200" />
        </main>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-y-auto min-h-0 bg-surface-bg select-none">
      {/* 1. Header: Simple "My Profile" with Back Navigation */}
      <Header
        title="My Profile"
        showBack={true}
        onBack={onBack}
      />

      <main className="flex-1 px-3.5 sm:px-4 py-3 sm:py-3.5 flex flex-col gap-3 max-w-md mx-auto w-full pb-4">
        {/* ============================================================ */}
        {/* 2. SECTION 1: MY PROFILE CARD */}
        {/* ============================================================ */}
        <Card variant="elevated" padding="md" className="shadow-soft p-3.5 space-y-2.5">
          <div className="flex items-center gap-3">
            {/* Friendly Avatar */}
            <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-brand-50 border-2 border-brand-200 flex items-center justify-center shrink-0 text-brand-700 shadow-2xs">
              <User className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>

            {/* User Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className="text-sm sm:text-base font-black text-content-primary truncate">
                  {profile.name || 'Frontline Trainee'}
                </h2>
                <Badge variant="brand" size="sm" className="text-[10px] py-0 px-1.5 font-bold">
                  {roleDisplay}
                </Badge>
              </div>

              {subCentreDisplay && (
                <div className="flex items-center gap-1.5 text-xs text-content-secondary mt-1 truncate">
                  <Building2 className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                  <span className="truncate">{subCentreDisplay}</span>
                </div>
              )}

              <div className="flex items-center gap-1.5 text-xs text-content-secondary mt-0.5 truncate">
                <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                <span className="truncate">{locationDisplay}</span>
              </div>
            </div>
          </div>

          {/* Single Edit Profile Action */}
          <div className="pt-1.5 border-t border-slate-100 flex justify-end">
            <button
              type="button"
              onClick={handleEditClick}
              className="inline-flex items-center gap-1 text-xs font-bold text-brand-700 hover:text-brand-800 active:text-brand-900 py-1 px-2 rounded-lg hover:bg-brand-50 transition-colors cursor-pointer min-h-[36px]"
            >
              <span>Edit Profile</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </Card>

        {/* Inline Profile Edit Modal / Form */}
        {isEditing && (
          <Card variant="default" padding="md" className="border-2 border-brand-300 bg-brand-50/40 space-y-2.5 p-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-brand-900">
                Edit Profile Information
              </h3>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="text-xs font-semibold text-content-secondary hover:text-content-primary p-1"
              >
                Cancel
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-content-primary mb-0.5">
                  Full Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-content-primary font-medium focus:outline-hidden focus:ring-2 focus:ring-brand-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-content-primary mb-0.5">
                  Role
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as 'ASHA_WORKER' | 'ANGANWADI_WORKER' | 'HEALTH_VOLUNTEER')}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-content-primary font-medium focus:outline-hidden focus:ring-2 focus:ring-brand-500 text-xs"
                >
                  <option value="ASHA_WORKER">ASHA Health Worker</option>
                  <option value="ANGANWADI_WORKER">Anganwadi Worker</option>
                  <option value="HEALTH_VOLUNTEER">Health Volunteer</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-content-primary mb-0.5">
                    State
                  </label>
                  <select
                    value={editState}
                    onChange={(e) => {
                      const newState = e.target.value;
                      setEditState(newState);
                      const validDistricts = getDistrictsForState(newState);
                      if (!validDistricts.includes(editDistrict)) {
                        setEditDistrict(validDistricts[0] || '');
                      }
                    }}
                    className="w-full px-2 py-1.5 rounded-lg bg-white border border-slate-300 text-content-primary font-medium focus:outline-hidden focus:ring-2 focus:ring-brand-500 text-xs cursor-pointer"
                  >
                    <option value="">Select State</option>
                    {INDIAN_STATES_AND_UTS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-content-primary mb-0.5">
                    District
                  </label>
                  <select
                    value={editDistrict}
                    onChange={(e) => setEditDistrict(e.target.value)}
                    disabled={!editState || getDistrictsForState(editState).length === 0}
                    className="w-full px-2 py-1.5 rounded-lg bg-white border border-slate-300 text-content-primary font-medium focus:outline-hidden focus:ring-2 focus:ring-brand-500 text-xs cursor-pointer disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    <option value="">
                      {editState ? 'Select District' : 'Select State first'}
                    </option>
                    {getDistrictsForState(editState).map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-content-primary mb-0.5">
                  Health Sub-Centre
                </label>
                <input
                  type="text"
                  value={editCenter}
                  onChange={(e) => setEditCenter(e.target.value)}
                  placeholder="Sub-centre name"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-content-primary font-medium focus:outline-hidden focus:ring-2 focus:ring-brand-500 text-xs"
                />
              </div>

              <div className="pt-1 flex justify-end gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsEditing(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSaveProfile}
                >
                  Save Changes
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* ============================================================ */}
        {/* 3. SECTION 2: MY LEARNING */}
        {/* ============================================================ */}
        <div className="space-y-1.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-content-primary px-0.5">
            My Learning
          </h3>

          <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
            {/* Current Streak Card */}
            <div className="bg-amber-50/80 border border-amber-200/90 rounded-xl p-2.5 flex flex-col items-center text-center justify-center min-h-[76px] shadow-2xs">
              <span className="text-base sm:text-lg" role="img" aria-label="streak">
                🔥
              </span>
              <span className="text-sm sm:text-base font-black text-amber-950 block leading-tight mt-0.5">
                {streakLabel}
              </span>
              <span className="text-[10px] sm:text-[11px] font-semibold text-amber-800/90 block mt-0.5">
                Streak
              </span>
            </div>

            {/* Learning Points Card */}
            <div className="bg-brand-50/80 border border-brand-200/90 rounded-xl p-2.5 flex flex-col items-center text-center justify-center min-h-[76px] shadow-2xs">
              <span className="text-base sm:text-lg" role="img" aria-label="learning points">
                ⚡
              </span>
              <span className="text-sm sm:text-base font-black text-brand-950 block leading-tight mt-0.5">
                {learningPointsCount}
              </span>
              <span className="text-[10px] sm:text-[11px] font-semibold text-brand-800/90 block mt-0.5">
                Points
              </span>
            </div>

            {/* Lessons Completed Card */}
            <div className="bg-emerald-50/80 border border-emerald-200/90 rounded-xl p-2.5 flex flex-col items-center text-center justify-center min-h-[76px] shadow-2xs">
              <span className="text-base sm:text-lg" role="img" aria-label="lessons completed">
                📚
              </span>
              <span className="text-sm sm:text-base font-black text-emerald-950 block leading-tight mt-0.5">
                {lessonsCompletedCount}
              </span>
              <span className="text-[10px] sm:text-[11px] font-semibold text-emerald-800/90 block mt-0.5">
                Lessons
              </span>
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* 4. SECTION 3: ACCOUNT */}
        {/* ============================================================ */}
        <div className="space-y-1.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-content-primary px-0.5">
            Account
          </h3>

          <Card variant="default" padding="none" className="overflow-hidden border border-slate-200/90 shadow-2xs rounded-xl">
            {/* Sign Out Row */}
            <button
              type="button"
              onClick={handleSignOutClick}
              className="w-full flex items-center justify-between px-3.5 py-3 hover:bg-rose-50/60 active:bg-rose-100/60 transition-colors text-left cursor-pointer min-h-[48px]"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                  <LogOut className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-rose-700 block">
                    Sign Out
                  </span>
                  <span className="text-[11px] text-content-secondary">
                    Keep your training progress saved
                  </span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-rose-400 shrink-0" />
            </button>
          </Card>
        </div>
      </main>
    </div>
  );
};
