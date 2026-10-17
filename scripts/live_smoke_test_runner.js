import React from 'react';
import { renderToString } from 'react-dom/server';
import { Header } from '../src/components/common/Header.js';
import { Card } from '../src/components/common/Card.js';
import { Button } from '../src/components/common/Button.js';
import { Badge } from '../src/components/common/Badge.js';
import { QuestionReviewScreen } from '../src/views/QuestionReviewScreen.js';
import { PowerUpsScreen } from '../src/views/PowerUpsScreen.js';
import { ProfileScreen } from '../src/views/ProfileScreen.js';
import { HomeScreen } from '../src/views/HomeScreen.js';
import { MCQRenderer } from '../src/components/questions/MCQRenderer.js';
import { StepOrderRenderer } from '../src/components/questions/StepOrderRenderer.js';
import { AudioDiscriminationRenderer } from '../src/components/questions/AudioDiscriminationRenderer.js';
import { ImageTapRenderer } from '../src/components/questions/ImageTapRenderer.js';
import { AnswerEvaluator } from '../src/services/AnswerEvaluator.js';

console.log('======================================================================');
console.log('AiSteth Academy - End-to-End Visual & Functional Smoke Test Runner');
console.log('======================================================================\n');

let totalChecks = 0;
let passedChecks = 0;

function assert(condition, testName, details = '') {
  totalChecks++;
  if (condition) {
    passedChecks++;
    console.log(`  ✓ [PASS] ${testName}`);
  } else {
    console.error(`  ✗ [FAIL] ${testName} - ${details}`);
    throw new Error(`Smoke Test Assertion Failed: ${testName} (${details})`);
  }
}

const mockStats = {
  currentStreak: 30,
  longestStreak: 30,
  totalXp: 185,
  completedQuestionsCount: 100,
  completedSessionsCount: 4,
  lastActiveDate: '2026-10-07',
  streakShieldConsumed: false,
};

const mockProfile = {
  id: 'Mm1TrJPtd0ZUhPgwjehmndpD8E12',
  name: 'powerup_qa_test',
  role: 'TRAINEE',
  district: 'Bengaluru',
  state: 'Karnataka',
  healthSubCentre: 'Kengeri Sub-Centre',
};

// 1. HEADER VERIFICATION (UI-002, FN-001, CODE-002)
console.log('--- 1. HEADER & NAVIGATION VERIFICATION ---');
const headerNarrow = renderToString(
  React.createElement(Header, {
    title: 'AiSteth Academy',
    streakCount: mockStats.currentStreak,
    xpCount: mockStats.totalXp,
    showBack: true,
    onBack: () => {},
  })
);
assert(headerNarrow.includes('30'), 'Header renders real user streak (30)');
assert(headerNarrow.includes('185'), 'Header renders real user XP (185)');
assert(headerNarrow.includes('AiSteth'), 'Header contains responsive title');
assert(headerNarrow.includes('Go Back'), 'Header renders accessible back button with label');
assert(!headerNarrow.includes('isOffline'), 'Header does not render dead isOffline prop (CODE-002)');

// 2. HOME SCREEN VERIFICATION (UI-003)
console.log('\n--- 2. HOME SCREEN VERIFICATION ---');
const homeHtml = renderToString(
  React.createElement(HomeScreen, {
    userStats: mockStats,
    onStartSession: () => {},
  })
);
assert(homeHtml.includes('Standard Auscultation Workflow'), 'Home screen renders Daily Mission title');
assert(homeHtml.includes('30'), 'Home screen renders 30 day streak');
assert(homeHtml.includes('185'), 'Home screen renders 185 XP');
assert(homeHtml.includes('100'), 'Home screen renders 100 completed questions');
assert(homeHtml.includes('Days Streak') || homeHtml.includes('Day Streak'), 'Home screen formats streak unit cleanly');

// 3. POWER-UPS SCREEN VERIFICATION (FN-001, Three Power-Ups Specification)
console.log('\n--- 3. POWER-UPS SCREEN VERIFICATION ---');
const powerUpsHtml = renderToString(
  React.createElement(PowerUpsScreen, {
    userStats: mockStats,
    onBack: () => {},
  })
);
assert(powerUpsHtml.includes('50/50'), 'Power-Ups screen contains 50/50');
assert(powerUpsHtml.includes('Learn'), 'Power-Ups screen contains Learn');
assert(powerUpsHtml.includes('Streak Shield'), 'Power-Ups screen contains Streak Shield');
assert(!powerUpsHtml.includes('Hint'), 'NO Hint power-up present (strictly removed)');
assert(!powerUpsHtml.includes('Retry'), 'NO Retry power-up present (strictly removed)');
assert(powerUpsHtml.includes('30'), 'Power-Ups Header displays real non-zero streak (30)');
assert(powerUpsHtml.includes('185'), 'Power-Ups Header displays real non-zero XP (185)');

// 4. PROFILE SCREEN VERIFICATION (UI-003, UI-004, VIS-002, FN-001)
console.log('\n--- 4. PROFILE SCREEN VERIFICATION ---');
const profileHtml = renderToString(
  React.createElement(ProfileScreen, {
    userProfile: mockProfile,
    userStats: mockStats,
    onBack: () => {},
  })
);
assert(profileHtml.includes('powerup_qa_test'), 'Profile screen renders username');
assert(profileHtml.includes('Bengaluru, Karnataka'), 'Profile screen renders location');
assert(profileHtml.includes('Streak') && profileHtml.includes('30 Days'), 'Profile displays My Learning streak card cleanly');
assert(profileHtml.includes('30'), 'Profile Header displays real non-zero streak (30)');
assert(profileHtml.includes('185'), 'Profile Header displays real non-zero XP (185)');

// Verify responsive grid in ProfileScreen component
import fs from 'fs';
const profileSource = fs.readFileSync('src/views/ProfileScreen.tsx', 'utf8');
assert(profileSource.includes('grid-cols-1 sm:grid-cols-2'), 'Profile edit form uses responsive grid (UI-004)');

// 5. REVIEW SCREEN VERIFICATION — CRITICAL REGRESSION TEST (UI-001)
console.log('\n--- 5. REVIEW SCREEN CRITICAL REGRESSION TEST ---');
const longQuestion = {
  question_id: 'DEMO_AUDIO_001',
  type: 'AUDIO_DISCRIMINATION',
  category: 'QUALITY_ASSESSMENT',
  difficulty: 'INTERMEDIATE',
  question: 'Listen to both recordings and select the clear recording without motion artifact:',
  audio_asset_a: '/assets/audio/clear_s1_s2.mp3',
  audio_asset_b: '/assets/audio/noisy_friction.mp3',
  label_a: 'Recording A (Standard Placement)',
  label_b: 'Recording B (Friction Artifact)',
  correct_choice: 'audio_a',
  clinical_finding: 'Clear physiological S1 and S2 heart sounds with zero rubbing friction artifact.',
  explanation: 'Recording A shows clear heart sounds.',
  source: 'DEMO',
  clinician_validated: false,
  version: '1.0.0',
};

const history10 = Array(10).fill(null).map((_, i) => ({
  questionId: `Q${i + 1}`,
  question: longQuestion,
  userAnswer: { type: 'AUDIO_DISCRIMINATION', selected_audio: i === 4 ? 'audio_a' : 'audio_b' },
  evaluation: {
    question_id: `Q${i + 1}`,
    is_correct: i === 4,
    status: i === 4 ? 'CORRECT' : 'INCORRECT',
    awarded_xp: i === 4 ? 5 : 0,
    explanation: 'Recording A shows clear heart sounds.',
    correct_solution_display: 'Recording A',
  },
  timestamp: Date.now(),
}));

const reviewHtml = renderToString(
  React.createElement(QuestionReviewScreen, {
    history: history10,
    onDone: () => {},
  })
);

const cleanReviewHtml = reviewHtml.replace(/<!-- -->/g, '');
assert(cleanReviewHtml.includes('Q5 • AUDIO_DISCRIMINATION'), 'Review screen contains Q5 • AUDIO_DISCRIMINATION');
assert(cleanReviewHtml.includes('Q10 • AUDIO_DISCRIMINATION'), 'Review screen contains Q10 • AUDIO_DISCRIMINATION');
assert(cleanReviewHtml.includes('QUALITY_ASSESSMENT'), 'Review screen contains QUALITY_ASSESSMENT badge');
assert(cleanReviewHtml.includes('Needs Review'), 'Review screen contains FULL "Needs Review" status badge');
assert(cleanReviewHtml.includes('Correct'), 'Review screen contains FULL "Correct" status badge');
assert(reviewHtml.includes('flex-wrap'), 'Review screen header uses flex-wrap to prevent horizontal collision');
assert(reviewHtml.includes('shrink-0 ml-auto'), 'Status badge uses shrink-0 ml-auto to prevent clipping');

// 6. QUESTION RENDERERS ACCESSIBILITY & LAYOUT (INT-001, VIS-001, A11Y-003, A11Y-004)
console.log('\n--- 6. QUESTION RENDERERS ACCESSIBILITY & LAYOUT ---');

// StepOrderRenderer
const stepOrderHtml = renderToString(
  React.createElement(StepOrderRenderer, {
    question: {
      question_id: 'STEP_001',
      type: 'STEP_ORDER',
      category: 'DEVICE_HANDLING',
      difficulty: 'INTERMEDIATE',
      question: 'Arrange steps in order:',
      initial_steps: [
        { id: 's1', text: 'Step 1' },
        { id: 's2', text: 'Step 2' },
      ],
      correct_step_order: ['s1', 's2'],
      explanation: 'First 1 then 2.',
      source: 'DEMO',
      clinician_validated: false,
      version: '1.0.0',
    },
  })
);
assert(stepOrderHtml.includes('min-w-[44px]') && stepOrderHtml.includes('min-h-[44px]'), 'StepOrderRenderer reorder controls enforce >=44x44px touch targets (INT-001)');

// AudioDiscriminationRenderer
const audioHtml = renderToString(
  React.createElement(AudioDiscriminationRenderer, {
    question: longQuestion,
  })
);
assert(audioHtml.includes('role="radiogroup"'), 'AudioDiscriminationRenderer container has role="radiogroup"');
assert(audioHtml.includes('role="radio"'), 'Audio cards have role="radio"');
assert(audioHtml.includes('aria-checked'), 'Audio cards have aria-checked (A11Y-004)');

// MCQRenderer
const mcqHtml = renderToString(
  React.createElement(MCQRenderer, {
    question: {
      question_id: 'MCQ_001',
      type: 'MCQ',
      category: 'DEVICE_HANDLING',
      difficulty: 'BEGINNER',
      question: 'Test question:',
      option_a: 'Option A with multiple lines of long text explaining clinical protocol in detail',
      option_b: 'Option B',
      option_c: 'Option C',
      option_d: 'Option D',
      correct_answer: 'option_a',
      explanation: 'Protocol explanation.',
      source: 'DEMO',
      clinician_validated: false,
      version: '1.0.0',
    },
  })
);
assert(mcqHtml.includes('items-start'), 'MCQRenderer aligns option badges to top with items-start (VIS-001)');

// ImageTapRenderer
const imageTapHtml = renderToString(
  React.createElement(ImageTapRenderer, {
    question: {
      question_id: 'TAP_001',
      type: 'IMAGE_TAP',
      category: 'ANATOMICAL_PLACEMENT',
      difficulty: 'BEGINNER',
      question: 'Tap area:',
      image_asset: '/assets/images/chest_auscultation_points.svg',
      target_zone: { x_min_percent: 5, y_min_percent: 8, x_max_percent: 25, y_max_percent: 28, label: 'Apex' },
      explanation: 'Apex.',
      source: 'DEMO',
      clinician_validated: false,
      version: '1.0.0',
    },
  })
);
assert(imageTapHtml.includes('role="application"'), 'ImageTapRenderer has role="application" (A11Y-003)');
assert(imageTapHtml.includes('arrow keys'), 'ImageTapRenderer includes accessible keyboard hints');

console.log('\n======================================================================');
console.log(`SMOKE TEST SUMMARY: ${passedChecks}/${totalChecks} ASSERTIONS PASSED (100%)`);
console.log('======================================================================\n');
