import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CloseIcon } from './icons';

interface Props {
  open: boolean;
  title: ReactNode;
  children: ReactNode;
  onClose: () => void;
  width?: number;
  footer?: ReactNode;
}

export default function BottomModal({ open, title, children, onClose, width = 720, footer }: Props) {
  const [present, setPresent] = useState(open);
  const pointerStartedOnMask = useRef(false);

  useEffect(() => {
    if (open) setPresent(true);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!present) return null;

  return createPortal(
    <div
      className="bottom-modal"
      data-state={open ? 'open' : 'closed'}
      onPointerDown={(event) => {
        pointerStartedOnMask.current = event.target === event.currentTarget;
      }}
      onPointerUp={(event) => {
        const endedOnMask = event.target === event.currentTarget;
        if (pointerStartedOnMask.current && endedOnMask) onClose();
        pointerStartedOnMask.current = false;
      }}
    >
      <section
        className="bottom-modal__panel"
        style={{ width: `min(100%, ${width}px)` }}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        onAnimationEnd={() => {
          if (!open) setPresent(false);
        }}
      >
        <div className="bottom-modal__header">
          <h2 className="bottom-modal__title">{title}</h2>
          <button className="bottom-modal__close" type="button" onClick={onClose} aria-label="关闭">
            <CloseIcon />
          </button>
        </div>
        <div className="bottom-modal__body">{children}</div>
        {footer ? <div className="bottom-modal__footer">{footer}</div> : null}
      </section>
    </div>,
    document.body,
  );
}
