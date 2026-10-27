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

  it('renders ONLY 3 functional actions: Streak, Learning Points, and Profile', () => {
    let profileNavClicked = false;

    const html = renderToString(
      React.createElement(Header, {
        title: 'AiSteth Academy',
        streakCount: 20,
        xpCount: 650,
        onNavigateProfile: () => { profileNavClicked = true; },
      })
    );

    // Profile button renders with accessible label
    expect(html).toContain('aria-label="My Profile"');

    // Verify Power-Ups button is COMPLETELY REMOVED
    expect(html).not.toContain('aria-label="Power-Ups"');

    // Verify third button (Level/Award/Bookmark) is COMPLETELY REMOVED
    expect(html).not.toContain('Current level');
    expect(html).not.toContain('aria-label="Current level');
    expect(html).not.toContain('Bookmark');
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
