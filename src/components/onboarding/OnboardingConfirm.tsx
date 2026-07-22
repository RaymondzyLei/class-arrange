import { Button } from 'antd';
import { useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useBodyScrollLock, useOverlayStack } from '@/components/overlayStack';
import { useManagedDialogFocus } from './useManagedDialogFocus';

interface Props {
  open: boolean;
  title: string;
  description: string;
  confirmText: string;
  cancelText?: string;
  returnFocusTarget?: HTMLElement | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function OnboardingConfirm({
  open,
  title,
  description,
  confirmText,
  cancelText = '继续引导',
  returnFocusTarget,
  onConfirm,
  onCancel,
}: Props) {
  const panelRef = useRef<HTMLElement | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);
  const titleId = `onboarding-confirm-${useId()}`;
  const {
    id,
    isTop,
    isFocusOwner,
    isTopBlocking,
    isInteractionBlocked,
    zIndex,
  } = useOverlayStack({
    active: open,
    priority: 1600,
    blocksLowerInteraction: true,
    managesFocus: true,
    onEscape: onCancel,
  });
  const isInteractive = open && isFocusOwner && !isInteractionBlocked;
  const isModal = isInteractive && isTop && isTopBlocking;

  useBodyScrollLock(open);
  useManagedDialogFocus({
    active: open,
    interactive: isInteractive,
    containerRef: panelRef,
    initialFocusRef: cancelButtonRef,
    returnFocusTarget,
  });

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="onboarding-confirm"
      data-overlay-id={id}
      data-overlay-top={isTop ? 'true' : 'false'}
      style={{ zIndex }}
      role="alertdialog"
      aria-modal={isModal ? true : undefined}
      aria-labelledby={titleId}
      inert={!isInteractive}
      aria-hidden={isInteractive ? undefined : true}
    >
      <section
        ref={panelRef}
        className="onboarding-confirm__panel"
        data-overlay-focus-root
        tabIndex={-1}
      >
        <h2 id={titleId} className="onboarding-confirm__title">{title}</h2>
        <p className="onboarding-confirm__description">{description}</p>
        <div className="onboarding-confirm__actions">
          <Button ref={cancelButtonRef} onClick={onCancel}>{cancelText}</Button>
          <Button danger type="primary" onClick={onConfirm}>{confirmText}</Button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
