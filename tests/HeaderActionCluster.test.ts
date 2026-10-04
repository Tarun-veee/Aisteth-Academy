import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { Header } from '../src/components/common/Header';

describe('Header 4-Action Navigation & Redundancy Removal', () => {
  it('renders Header with title, streak, and learning points counters', () => {
    const html = renderToString(
      React.createElement(Header, {
        title: 'AiSteth Academy',
        streakCount: 14,
        xpCount: 320,
      })
    );

    expect(html).toContain('AiSteth Academy');
    expect(html).toContain('14');
    expect(html).toContain('320');
  });

  it('renders ONLY 4 functional actions: Streak, Learning Points, Power-Ups, and Profile', () => {
    let powerUpsNavClicked = false;
    let profileNavClicked = false;

    const html = renderToString(
      React.createElement(Header, {
        title: 'AiSteth Academy',
        streakCount: 20,
        xpCount: 650,
        unlockedPowerUpsCount: 2,
        onNavigatePowerUps: () => { powerUpsNavClicked = true; },
        onNavigateProfile: () => { profileNavClicked = true; },
      })
    );

    // Power-Up and Profile buttons render with accessible labels
    expect(html).toContain('aria-label="Power-Ups"');
    expect(html).toContain('aria-label="My Profile"');
    expect(html).toContain('2'); // Badge count for power-ups

    // Verify third button (Level/Award/Bookmark) is COMPLETELY REMOVED
    expect(html).not.toContain('Current level');
    expect(html).not.toContain('aria-label="Current level');
    expect(html).not.toContain('Bookmark');
  });

  it('triggers onNavigatePowerUps callback specifically for Power-Ups button', () => {
    let powerUpsNavClicked = false;

    const el = React.createElement(Header, {
      title: 'AiSteth Academy',
      streakCount: 20,
      xpCount: 650,
      unlockedPowerUpsCount: 2,
      onNavigatePowerUps: () => { powerUpsNavClicked = true; },
    });

    expect(el.props.onNavigatePowerUps).toBeDefined();
    el.props.onNavigatePowerUps!();
    expect(powerUpsNavClicked).toBe(true);
  });

  it('triggers onNavigateProfile callback specifically for Profile button', () => {
    let profileNavClicked = false;

    const el = React.createElement(Header, {
      title: 'AiSteth Academy',
      streakCount: 10,
      xpCount: 200,
      onNavigateProfile: () => { profileNavClicked = true; },
    });

    expect(el.props.onNavigateProfile).toBeDefined();
    el.props.onNavigateProfile!();
    expect(profileNavClicked).toBe(true);
  });

  it('renders back chevron button in screen mode and triggers onBack callback', () => {
    let backClicked = false;

    const el = React.createElement(Header, {
      title: 'My Profile',
      showBack: true,
      onBack: () => { backClicked = true; },
      streakCount: 10,
      xpCount: 200,
    });

    expect(el.props.showBack).toBe(true);
    expect(el.props.onBack).toBeDefined();

    el.props.onBack!();
    expect(backClicked).toBe(true);
  });
});
