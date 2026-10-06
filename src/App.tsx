import { useState } from 'react';
import { MobileContainer } from './layouts/MobileContainer';
import { HomeScreen } from './views/HomeScreen';
import { DailySessionScreen } from './views/DailySessionScreen';
import { QuestionReviewScreen } from './views/QuestionReviewScreen';
import { ProfileScreen } from './views/ProfileScreen';
import { PowerUpsScreen } from './views/PowerUpsScreen';
import { SignInScreen } from './views/SignInScreen';
import { SignUpScreen } from './views/SignUpScreen';
import { ForgotPasswordScreen } from './views/ForgotPasswordScreen';
import { useLearningSession } from './hooks/useLearningSession';
import { defaultAuthService } from './services/AuthService';
import { AuthStatus, AuthView } from './models/auth.types';
import { UserProfile } from './models/user.types';

type ProtectedViewMode = 'HOME' | 'SESSION' | 'REVIEW' | 'PROFILE' | 'POWER_UPS';

export function App() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>(() => {
    return defaultAuthService.isAuthenticated() ? 'AUTHENTICATED' : 'UNAUTHENTICATED';
  });
  const [authView, setAuthView] = useState<AuthView>('SIGN_IN');
  const [currentView, setCurrentView] = useState<ProtectedViewMode>('HOME');

  const {
    session,
    userStats,
    isLoading,
    currentQuestion,
    startDailySession,
    setAnswer,
    submitCurrentAnswer,
    applyFiftyFifty,
    applyLearn,
    nextQuestion,
    markReviewViewed,
    refreshUserStats,
  } = useLearningSession();

  // Handle successful login or account creation
  const handleAuthSuccess = (_profile: UserProfile) => {
    setAuthStatus('AUTHENTICATED');
    setCurrentView('HOME');
    refreshUserStats();
  };

  // Handle Sign Out
  const handleSignOut = async () => {
    await defaultAuthService.signOut();
    setAuthStatus('UNAUTHENTICATED');
    setAuthView('SIGN_IN');
    setCurrentView('HOME');
  };

  // Handle starting or resuming today's session
  const handleStartSession = async () => {
    if (session.dailyStatus === 'NOT_STARTED') {
      await startDailySession();
      setCurrentView('SESSION');
    } else if (session.dailyStatus === 'IN_PROGRESS') {
      setCurrentView('SESSION');
    } else if (session.dailyStatus === 'QUESTIONS_COMPLETED') {
      setCurrentView('REVIEW');
    }
  };

  // Handle exiting from active session back to home without discarding daily progress
  const handleExitSession = () => {
    setCurrentView('HOME');
  };

  // Handle completing question and transitioning directly to Session Review on Q10
  const handleNextQuestion = async () => {
    const nextIdx = session.currentIndex + 1;
    const isFinished = nextIdx >= session.questions.length;
    await nextQuestion();
    if (isFinished) {
      setCurrentView('REVIEW');
    }
  };

  // Handle pressing Done on Session Review (locks today's session and returns to Home)
  const handleDoneReview = async () => {
    await markReviewViewed();
    setCurrentView('HOME');
  };

  // Handle navigating to Profile view
  const handleNavigateProfile = () => {
    setCurrentView('PROFILE');
  };

  // Handle returning from Profile view back to Home
  const handleBackFromProfile = () => {
    setCurrentView('HOME');
  };

  // Handle navigating to Power-Ups view
  const handleNavigatePowerUps = () => {
    setCurrentView('POWER_UPS');
  };

  // Handle returning from Power-Ups view back to Home
  const handleBackFromPowerUps = () => {
    setCurrentView('HOME');
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
          onNavigatePowerUps={handleNavigatePowerUps}
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
          onApplyFiftyFifty={applyFiftyFifty}
          onApplyLearn={applyLearn}
          onNextQuestion={handleNextQuestion}
          onExitSession={handleExitSession}
        />
      )}

      {currentView === 'REVIEW' && (
        <QuestionReviewScreen
          history={session.history}
          onDone={handleDoneReview}
        />
      )}

      {currentView === 'PROFILE' && (
        <ProfileScreen
          userStats={userStats}
          onBack={handleBackFromProfile}
          onSignOut={handleSignOut}
        />
      )}

      {currentView === 'POWER_UPS' && (
        <PowerUpsScreen
          userStats={userStats}
          onBack={handleBackFromPowerUps}
        />
      )}
    </MobileContainer>
  );
}

export default App;
