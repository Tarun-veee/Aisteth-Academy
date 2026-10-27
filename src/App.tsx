import { useState, useEffect, useCallback } from 'react';
import { MobileContainer } from './layouts/MobileContainer';
import { HomeScreen } from './views/HomeScreen';
import { DailySessionScreen } from './views/DailySessionScreen';
import { QuestionReviewScreen } from './views/QuestionReviewScreen';
import { ProfileScreen } from './views/ProfileScreen';
import { LeaderboardScreen } from './views/LeaderboardScreen';
import { SignInScreen } from './views/SignInScreen';
import { SignUpScreen } from './views/SignUpScreen';
import { ForgotPasswordScreen } from './views/ForgotPasswordScreen';
import { AdminDashboard } from './views/admin/AdminDashboard';
import { useLearningSession } from './hooks/useLearningSession';
import { defaultAuthService } from './services/AuthService';
import { AuthStatus, AuthView } from './models/auth.types';
import { UserProfile } from './models/user.types';

type ProtectedViewMode = 'HOME' | 'SESSION' | 'REVIEW' | 'PROFILE' | 'UNSOLVED' | 'LEADERBOARD' | 'ADMIN';

const VIEW_TO_HASH: Record<ProtectedViewMode, string> = {
  HOME: '',
  SESSION: 'session',
  REVIEW: 'review',
  PROFILE: 'profile',
  UNSOLVED: 'unsolved',
  LEADERBOARD: 'leaderboard',
  ADMIN: 'admin',
};

const getProtectedViewFromHash = (): ProtectedViewMode => {
  if (typeof window === 'undefined') return 'HOME';
  const rawHash = window.location.hash.replace(/^#\/?/, '').toLowerCase();
  if (rawHash === 'session') return 'SESSION';
  if (rawHash === 'review') return 'HOME';
  if (rawHash === 'profile') return 'PROFILE';
  if (rawHash === 'unsolved' || rawHash === 'vault') return 'UNSOLVED';
  if (rawHash === 'leaderboard') return 'LEADERBOARD';
  if (rawHash === 'admin') return 'ADMIN';
  return 'HOME';
};

export function App() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>(() => {
    return defaultAuthService.isAuthenticated() ? 'AUTHENTICATED' : 'UNAUTHENTICATED';
  });
  const [authView, setAuthView] = useState<AuthView>('SIGN_IN');
  const [currentView, setCurrentView] = useState<ProtectedViewMode>(() => {
    if (defaultAuthService.isAuthenticated()) {
      return getProtectedViewFromHash();
    }
    return 'HOME';
  });

  const {
    session,
    userStats,
    isLoading,
    currentQuestion,
    startDailySession,
    initDailySession,
    setAnswer,
    submitCurrentAnswer,
    nextQuestion,
    markReviewViewed,
    refreshUserStats,
    resetSessionState,
  } = useLearningSession();

  // Navigation with browser history synchronization
  const navigateTo = useCallback((view: ProtectedViewMode) => {
    setCurrentView(view);
    if (typeof window === 'undefined') return;

    const targetHash = VIEW_TO_HASH[view];
    const currentHash = window.location.hash.replace(/^#\/?/, '').toLowerCase();
    if (currentHash !== targetHash) {
      if (targetHash) {
        window.location.hash = targetHash;
      } else {
        if (window.history.pushState) {
          window.history.pushState(null, '', window.location.pathname + window.location.search);
        } else {
          window.location.hash = '';
        }
      }
    }
  }, []);

  const navigateBack = useCallback(() => {
    if (typeof window !== 'undefined' && window.location.hash && window.history.length > 1) {
      window.history.back();
    } else {
      navigateTo('HOME');
    }
  }, [navigateTo]);

  // Synchronize browser back/forward and hardware Android back button
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleNavigationChange = () => {
      const targetView = getProtectedViewFromHash();
      setCurrentView(targetView);
    };

    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible' && defaultAuthService.isAuthenticated()) {
        refreshUserStats();
        initDailySession();
      }
    };

    window.addEventListener('hashchange', handleNavigationChange);
    window.addEventListener('popstate', handleNavigationChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      window.removeEventListener('hashchange', handleNavigationChange);
      window.removeEventListener('popstate', handleNavigationChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [refreshUserStats, initDailySession]);

  // Silent session rehydration via HttpOnly refresh cookie on application startup
  useEffect(() => {
    defaultAuthService.rehydrateSession().then((rehydrated) => {
      if (rehydrated) {
        setAuthStatus('AUTHENTICATED');
        refreshUserStats();
        initDailySession();
      } else {
        setAuthStatus('UNAUTHENTICATED');
        setAuthView('SIGN_IN');
      }
    });
  }, [refreshUserStats, initDailySession]);

  // Handle successful login or account creation
  const handleAuthSuccess = (_profile: UserProfile) => {
    setAuthStatus('AUTHENTICATED');
    navigateTo('HOME');
    refreshUserStats();
    initDailySession();
  };

  // Handle Sign Out
  const handleSignOut = async () => {
    await defaultAuthService.signOut();
    resetSessionState();
    setAuthStatus('UNAUTHENTICATED');
    setAuthView('SIGN_IN');
    navigateTo('HOME');
  };

  // Handle starting or resuming today's session
  const handleStartSession = async () => {
    if (session.dailyStatus === 'NOT_STARTED') {
      await startDailySession();
      navigateTo('SESSION');
    } else if (session.dailyStatus === 'IN_PROGRESS') {
      if (session.questions.length === 0 || !currentQuestion) {
        await initDailySession();
      }
      navigateTo('SESSION');
    }
  };

  // Handle exiting from active session back to home without discarding daily progress
  const handleExitSession = () => {
    navigateBack();
  };

  // Handle completing question and transitioning directly to Home upon completion
  const handleNextQuestion = async () => {
    const isFinished = Boolean(
      session.serverPendingTransition?.isSessionComplete ||
      (session.serverPendingTransition?.branchState === 'MAIN' &&
       (session.serverPendingTransition?.currentQuestionIndex ?? (session.currentIndex + 1)) >= session.questions.length)
    );
    await nextQuestion();
    if (isFinished) {
      await markReviewViewed();
      navigateTo('HOME');
    }
  };

  // Automatically transition to Home when session reaches completed status
  useEffect(() => {
    const isSessionDone =
      session.dailyStatus === 'QUESTIONS_COMPLETED' ||
      session.dailyStatus === 'REVIEW_VIEWED' ||
      session.dailyStatus === 'COMPLETED' ||
      session.dailyStatus === 'REVIEW_COMPLETED' ||
      session.questionsCompleted;

    if (currentView === 'SESSION' && isSessionDone) {
      markReviewViewed();
      navigateTo('HOME');
    } else if (currentView === 'REVIEW') {
      navigateTo('HOME');
    }
  }, [currentView, session.dailyStatus, session.questionsCompleted, markReviewViewed, navigateTo]);

  // Handle pressing Done on Session Review (locks today's session and returns to Home)
  const handleDoneReview = async () => {
    await markReviewViewed();
    navigateTo('HOME');
  };

  // Handle navigating to Profile view
  const handleNavigateProfile = () => {
    navigateTo('PROFILE');
  };

  // Handle returning from Profile view back to Home
  const handleBackFromProfile = () => {
    navigateBack();
  };



  // Handle returning from Unsolved Clinical Vault back to Home
  const handleBackFromUnsolved = () => {
    navigateBack();
  };

  // Handle navigating to Community Leaderboard
  const handleNavigateLeaderboard = () => {
    navigateTo('LEADERBOARD');
  };

  // Handle returning from Community Leaderboard back to Home
  const handleBackFromLeaderboard = () => {
    navigateBack();
  };

  // ============================================================
  // Unauthenticated Flow: Sign In, Sign Up, Forgot Password
  // ============================================================
  if (authStatus === 'UNAUTHENTICATED') {
    return (
      <MobileContainer>
        {authView === 'SIGN_IN' && (
          <SignInScreen
            onSuccess={handleAuthSuccess}
            onNavigateSignUp={() => setAuthView('SIGN_UP')}
            onNavigateForgotPassword={() => setAuthView('FORGOT_PASSWORD')}
          />
        )}

        {authView === 'SIGN_UP' && (
          <SignUpScreen
            onSuccess={handleAuthSuccess}
            onNavigateSignIn={() => setAuthView('SIGN_IN')}
          />
        )}

        {authView === 'FORGOT_PASSWORD' && (
          <ForgotPasswordScreen
            onNavigateSignIn={() => setAuthView('SIGN_IN')}
          />
        )}
      </MobileContainer>
    );
  }

  // ============================================================
  // Authenticated Protected Views
  // ============================================================
  if (currentView === 'ADMIN') {
    return (
      <AdminDashboard
        onNavigateLearnerView={() => navigateTo('HOME')}
        onSignOut={handleSignOut}
        adminDisplayName={defaultAuthService.getSession()?.emailOrPhone || 'Administrator'}
      />
    );
  }

  return (
    <MobileContainer>
      {currentView === 'HOME' && (
        <HomeScreen
          userStats={userStats}
          dailyStatus={session.dailyStatus}
          currentQuestionIndex={session.currentIndex}
          totalQuestionsCount={session.questions.length || 10}
          onStartSession={handleStartSession}
          onNavigateProfile={handleNavigateProfile}
          onNavigateLeaderboard={handleNavigateLeaderboard}
          isLoading={isLoading}
          onRetry={refreshUserStats}
        />
      )}

      {currentView === 'SESSION' && (
        <DailySessionScreen
          session={session}
          userStats={userStats}
          currentQuestion={currentQuestion}
          onSetAnswer={setAnswer}
          onSubmitAnswer={submitCurrentAnswer}
          onNextQuestion={handleNextQuestion}
          onExitSession={handleExitSession}
          onRetry={initDailySession}
          isLoading={isLoading}
        />
      )}

      {currentView === 'REVIEW' && (
        <QuestionReviewScreen
          mode="SESSION_SUMMARY"
          history={session.history}
          onDone={handleDoneReview}
        />
      )}

      {currentView === 'UNSOLVED' && (
        <QuestionReviewScreen
          mode="UNSOLVED_VAULT"
          onDone={handleBackFromUnsolved}
          onNavigateHome={() => navigateTo('HOME')}
        />
      )}

      {currentView === 'PROFILE' && (
        <ProfileScreen
          userStats={userStats}
          onBack={handleBackFromProfile}
          onSignOut={handleSignOut}
          onNavigateAdmin={() => navigateTo('ADMIN')}
        />
      )}



      {currentView === 'LEADERBOARD' && (
        <LeaderboardScreen
          userStats={userStats}
          onBack={handleBackFromLeaderboard}
        />
      )}
    </MobileContainer>
  );
}

export default App;
