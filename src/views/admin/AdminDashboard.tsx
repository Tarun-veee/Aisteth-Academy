import React, { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  UserPlus,
  Upload,
  LogOut,
  GraduationCap,
  Menu,
  X,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';
import { AdminOverview } from './AdminOverview';
import { AdminLearnerList } from './AdminLearnerList';
import { AdminAddLearner } from './AdminAddLearner';
import { AdminBulkImport } from './AdminBulkImport';

export type AdminTab = 'overview' | 'learners' | 'add' | 'bulk';

interface AdminDashboardProps {
  onNavigateLearnerView: () => void;
  onSignOut: () => void;
  adminDisplayName?: string;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onNavigateLearnerView,
  onSignOut,
  adminDisplayName = 'Administrator',
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'learners', label: 'Learners Directory', icon: Users },
    { id: 'add', label: 'Add Individual', icon: UserPlus },
    { id: 'bulk', label: 'Bulk CSV Import', icon: Upload },
  ] as const;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-slate-900 font-sans">
      {/* Sidebar (Desktop) */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200/80 p-5 shrink-0 justify-between">
        <div className="space-y-6">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 px-2">
            <div className="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center shadow-md shadow-brand-600/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <span className="font-extrabold text-slate-900 text-base tracking-tight block">AiSteth Admin</span>
              <span className="text-[10px] text-brand-600 font-bold uppercase tracking-wider block">
                RBSK Learning Engine
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-brand-50 text-brand-700 font-bold shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-brand-600' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer Area */}
        <div className="space-y-3 pt-4 border-t border-slate-100">
          {/* Switch to Learner App */}
          <button
            onClick={onNavigateLearnerView}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-brand-700 hover:bg-brand-50/60 border border-slate-200 transition-colors"
          >
            <div className="flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-brand-600" />
              <span>Learner View</span>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {/* Profile & Logout */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
            <div className="min-w-0 pr-2">
              <span className="text-xs font-bold text-slate-900 block truncate">{adminDisplayName}</span>
              <span className="text-[10px] text-slate-400 block font-medium">Administrator</span>
            </div>
            <button
              onClick={onSignOut}
              title="Sign Out"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Top Header */}
      <div className="md:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-30 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand-600 text-white flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="font-bold text-slate-900 text-sm block">AiSteth Admin</span>
            <span className="text-[9px] text-brand-600 font-semibold uppercase">RBSK Onboarding</span>
          </div>
        </div>

        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-600 hover:bg-slate-100"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-slate-200 p-4 space-y-3 animate-in slide-in-from-top-2 duration-150 z-20">
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold ${
                    isActive ? 'bg-brand-50 text-brand-700 font-bold' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-brand-600' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onNavigateLearnerView();
              }}
              className="text-xs font-bold text-brand-600 flex items-center gap-1.5"
            >
              <GraduationCap className="w-4 h-4" />
              <span>Switch to Learner View</span>
            </button>
            <button onClick={onSignOut} className="text-xs font-bold text-rose-600 flex items-center gap-1.5">
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="hidden md:flex items-center justify-between px-8 py-4 bg-white border-b border-slate-200/80">
          <div>
            <h2 className="text-base font-bold text-slate-800">
              {navItems.find((n) => n.id === activeTab)?.label}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onNavigateLearnerView}
              className="text-xs font-semibold text-slate-600 hover:text-brand-600 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-brand-200 transition-colors"
            >
              <GraduationCap className="w-4 h-4 text-brand-600" />
              <span>Learner Training Mode</span>
            </button>
          </div>
        </header>

        <div className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl w-full mx-auto">
          {activeTab === 'overview' && <AdminOverview onNavigateTab={(tab) => setActiveTab(tab)} />}
          {activeTab === 'learners' && <AdminLearnerList />}
          {activeTab === 'add' && <AdminAddLearner onNavigateBack={() => setActiveTab('learners')} />}
          {activeTab === 'bulk' && <AdminBulkImport />}
        </div>
      </main>
    </div>
  );
};
