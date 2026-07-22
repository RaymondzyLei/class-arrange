// @vitest-environment jsdom

import {
  StrictMode,
  act,
  createElement,
  type ReactNode,
} from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { DEFAULT_ONBOARDING_PREFERENCES } from '@/onboarding/useOnboarding';
import { getOverlayStackSnapshot } from '@/components/overlayStack';
import OnboardingConfirm from './OnboardingConfirm';
import OnboardingWizard from './OnboardingWizard';

interface MountedRoot {
  readonly root: Root;
  rerender: (node: ReactNode) => Promise<void>;
}

const mountedRoots: MountedRoot[] = [];

async function mount(node: ReactNode): Promise<MountedRoot> {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const mounted: MountedRoot = {
    root,
    rerender: async (nextNode) => {
      await act(async () => {
        root.render(nextNode);
        await Promise.resolve();
      });
    },
  };
  mountedRoots.push(mounted);
  await mounted.rerender(node);
  return mounted;
}

async function keydown(key: string): Promise<KeyboardEvent> {
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    key,
  });
  await act(async () => {
    document.dispatchEvent(event);
    await Promise.resolve();
    await Promise.resolve();
  });
  return event;
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(async () => {
  await act(async () => {
    for (const { root } of mountedRoots.splice(0).reverse()) root.unmount();
    await Promise.resolve();
  });

  expect(getOverlayStackSnapshot()).toHaveLength(0);
  document.body.replaceChildren();
  document.body.style.cssText = '';
  document.documentElement.style.cssText = '';
});

describe('onboarding overlay interactions', () => {
  test('keeps only the interactive top layer modal and restores the exact pre-confirm focus', async () => {
    const onSkip = vi.fn();
    await mount(createElement(
      StrictMode,
      null,
      createElement(OnboardingWizard, {
        open: true,
        preferences: DEFAULT_ONBOARDING_PREFERENCES,
        onComplete: vi.fn(),
        onSkip,
      }),
    ));

    const wizard = document.querySelector<HTMLElement>('.onboarding-wizard')!;
    const wizardPanel = wizard.querySelector<HTMLElement>('.onboarding-wizard__panel')!;
    const primaryAction = wizard.querySelector<HTMLElement>(
      '.onboarding-wizard__actions .ant-btn-primary',
    )!;

    expect(wizardPanel.getAttribute('aria-modal')).toBe('true');
    primaryAction.focus();
    expect(document.activeElement).toBe(primaryAction);

    const firstEscape = await keydown('Escape');
    const confirm = document.querySelector<HTMLElement>('.onboarding-confirm')!;
    const cancelButton = confirm.querySelector<HTMLElement>(
      '.onboarding-confirm__actions button',
    )!;

    expect(firstEscape.defaultPrevented).toBe(true);
    expect(wizard.hasAttribute('inert')).toBe(true);
    expect(wizardPanel.getAttribute('aria-modal')).toBeNull();
    expect(confirm.getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).toBe(cancelButton);

    const secondEscape = await keydown('Escape');

    expect(secondEscape.defaultPrevented).toBe(true);
    expect(document.querySelector('.onboarding-confirm')).toBeNull();
    expect(wizard.hasAttribute('inert')).toBe(false);
    expect(wizardPanel.getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).toBe(primaryAction);
    expect(onSkip).not.toHaveBeenCalled();
  });

  test('locks scrolling for a standalone confirmation and restores its explicit target', async () => {
    document.body.style.overflow = 'auto';
    const trigger = document.createElement('button');
    trigger.type = 'button';
    document.body.append(trigger);
    trigger.focus();
    const onCancel = vi.fn();
    const confirm = (open: boolean) => createElement(
      StrictMode,
      null,
      createElement(OnboardingConfirm, {
        open,
        title: 'Skip tour?',
        description: 'Confirm skipping the tour.',
        confirmText: 'Skip',
        returnFocusTarget: trigger,
        onCancel,
        onConfirm: vi.fn(),
      }),
    );
    const mounted = await mount(confirm(true));

    expect(document.body.style.overflow).toBe('hidden');
    expect(document.querySelector('.onboarding-confirm')?.getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).toBe(
      document.querySelector('.onboarding-confirm__actions button'),
    );

    await mounted.rerender(confirm(false));
    await act(async () => {
      await Promise.resolve();
    });

    expect(document.querySelector('.onboarding-confirm')).toBeNull();
    expect(document.body.style.overflow).toBe('auto');
    expect(document.activeElement).toBe(trigger);
  });
});
