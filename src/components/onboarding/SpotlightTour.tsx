import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { tourSteps, type TourPlacement, type TourStep } from '@/onboarding/tourSteps';
import OnboardingConfirm from './OnboardingConfirm';
import TourCard from './TourCard';
import './onboarding.css';

type TourAction = NonNullable<TourStep['action']>;
type TourEntryMode = 'wizard' | 'manual';

interface Props {
  open: boolean;
  entryMode?: TourEntryMode;
  onFinish: () => void;
  onSkip: () => void;
  onStepAction: (action: TourAction) => void;
}

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface CardPosition {
  top: number;
  left: number;
  placement: TourPlacement | 'mobile';
}

interface ClickPoint {
  key: string;
  x: number;
  y: number;
}

type SidePlacement = Exclude<TourPlacement, 'center'>;

const SPOTLIGHT_MARGIN = 10;
const VIEWPORT_PADDING = 12;
const CARD_GAP = 16;
const DESKTOP_CARD_WIDTH = 360;
const DEFAULT_CARD_HEIGHT = 220;
const SIDE_PLACEMENTS: SidePlacement[] = ['right', 'bottom', 'left', 'top'];
const ARRANGEMENT_PREVIEW_CONFLICTS = [4, 4, 4, 4, 6, 6];
const ARRANGEMENT_PREVIEW_HEIGHT = 260;
const FIRST_FLOAT_STEP_ID = tourSteps[0]?.entryAnimation === 'float' ? tourSteps[0].id : '';

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

function orderedPlacements(preferred: TourPlacement): SidePlacement[] {
  const ordered: SidePlacement[] = [];
  if (preferred !== 'center') ordered.push(preferred);
  for (const placement of SIDE_PLACEMENTS) {
    if (!ordered.includes(placement)) ordered.push(placement);
  }
  return ordered;
}

function getTargetRect(target: HTMLElement): SpotlightRect {
  const bounds = target.getBoundingClientRect();
  const left = Math.max(VIEWPORT_PADDING, bounds.left - SPOTLIGHT_MARGIN);
  const top = Math.max(VIEWPORT_PADDING, bounds.top - SPOTLIGHT_MARGIN);
  const right = Math.min(window.innerWidth - VIEWPORT_PADDING, bounds.right + SPOTLIGHT_MARGIN);
  const bottom = Math.min(window.innerHeight - VIEWPORT_PADDING, bounds.bottom + SPOTLIGHT_MARGIN);

  return {
    left,
    top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

function stepSelectors(step: TourStep): string[] {
  return [...(step.targets ?? []), ...(step.target ? [step.target] : [])];
}

function getTargetRects(step: TourStep): SpotlightRect[] {
  const targetRects = stepSelectors(step)
    .flatMap((selector) => [...document.querySelectorAll<HTMLElement>(selector)])
    .map(getTargetRect)
    .filter((item) => item.width > 0 && item.height > 0);
  if (!step.mergeTargets) return targetRects;
  const mergedRect = unionRects(targetRects);
  return mergedRect ? [mergedRect] : [];
}

function unionRects(rects: SpotlightRect[]): SpotlightRect | null {
  if (rects.length === 0) return null;
  const left = Math.min(...rects.map((item) => item.left));
  const top = Math.min(...rects.map((item) => item.top));
  const right = Math.max(...rects.map((item) => item.left + item.width));
  const bottom = Math.max(...rects.map((item) => item.top + item.height));
  return {
    left,
    top,
    width: right - left,
    height: bottom - top,
  };
}

function cardPositionFor(
  rect: SpotlightRect | null,
  preferred: TourPlacement,
  cardWidth: number,
  cardHeight: number,
): CardPosition {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const maxLeft = Math.max(VIEWPORT_PADDING, viewportWidth - cardWidth - VIEWPORT_PADDING);
  const maxTop = Math.max(VIEWPORT_PADDING, viewportHeight - cardHeight - VIEWPORT_PADDING);

  if (viewportWidth <= 640) {
    return {
      left: VIEWPORT_PADDING,
      top: Math.max(VIEWPORT_PADDING, viewportHeight - cardHeight - VIEWPORT_PADDING),
      placement: 'mobile',
    };
  }

  if (!rect || preferred === 'center') {
    return {
      left: clamp((viewportWidth - cardWidth) / 2, VIEWPORT_PADDING, maxLeft),
      top: clamp((viewportHeight - cardHeight) / 2, VIEWPORT_PADDING, maxTop),
      placement: 'center',
    };
  }

  const candidates = orderedPlacements(preferred).map((placement) => {
    if (placement === 'right') {
      return {
        placement,
        left: rect.left + rect.width + CARD_GAP,
        top: rect.top,
        fits: rect.left + rect.width + CARD_GAP + cardWidth <= viewportWidth - VIEWPORT_PADDING,
      };
    }
    if (placement === 'bottom') {
      return {
        placement,
        left: rect.left,
        top: rect.top + rect.height + CARD_GAP,
        fits: rect.top + rect.height + CARD_GAP + cardHeight <= viewportHeight - VIEWPORT_PADDING,
      };
    }
    if (placement === 'left') {
      return {
        placement,
        left: rect.left - cardWidth - CARD_GAP,
        top: rect.top,
        fits: rect.left - cardWidth - CARD_GAP >= VIEWPORT_PADDING,
      };
    }
    return {
      placement,
      left: rect.left,
      top: rect.top - cardHeight - CARD_GAP,
      fits: rect.top - cardHeight - CARD_GAP >= VIEWPORT_PADDING,
    };
  });

  const selected = candidates.find((candidate) => candidate.fits) ?? candidates[0];
  return {
    left: clamp(selected.left, VIEWPORT_PADDING, maxLeft),
    top: clamp(selected.top, VIEWPORT_PADDING, maxTop),
    placement: selected.placement,
  };
}

function getArrangementPreviewRect(): SpotlightRect {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const fallbackWidth = viewportWidth - VIEWPORT_PADDING * 2;
  if (viewportWidth <= 640) {
    return {
      left: VIEWPORT_PADDING,
      top: VIEWPORT_PADDING + 58,
      width: fallbackWidth,
      height: Math.min(ARRANGEMENT_PREVIEW_HEIGHT, viewportHeight - VIEWPORT_PADDING * 2 - 58),
    };
  }

  const poolPanel = document.querySelector<HTMLElement>('.pool-panel');
  const planSummary = document.querySelector<HTMLElement>('.plan-summary');
  if (!poolPanel) {
    return {
      left: VIEWPORT_PADDING,
      top: VIEWPORT_PADDING + 92,
      width: Math.min(520, fallbackWidth),
      height: ARRANGEMENT_PREVIEW_HEIGHT,
    };
  }

  const poolRect = poolPanel.getBoundingClientRect();
  const summaryRect = planSummary?.getBoundingClientRect();
  const top = (summaryRect?.bottom ?? poolRect.top) + 8;
  const bottomLimit = Math.min(poolRect.bottom, viewportHeight - VIEWPORT_PADDING);
  const availableHeight = Math.max(240, bottomLimit - top);

  return {
    left: poolRect.left,
    top,
    width: poolRect.width,
    height: Math.min(ARRANGEMENT_PREVIEW_HEIGHT, availableHeight),
  };
}

function ArrangementPanelPreview({ rect }: { rect: SpotlightRect }) {
  return (
    <div
      className="panel-inner arrangement-panel spotlight-tour__arrangement-preview"
      data-tour="arrangement-preview"
      style={{
        top: rect.top,
        left: rect.left,
        width: rect.width,
      }}
      aria-hidden="true"
    >
      <div className="arrangement-panel__head">
        <span className="arrangement-panel__title">排课方案</span>
        <span className="arrangement-panel__sub">共 6 种方案</span>
      </div>
      <div className="arrangement-panel__list">
        {ARRANGEMENT_PREVIEW_CONFLICTS.map((conflictCount, index) => (
          <div
            key={index}
            className={`arrangement-card${index === 0 ? ' arrangement-card--applied' : ''}`}
          >
            <div className="arrangement-card__row">
              <span className="arrangement-card__idx">#{index}</span>
              <span className="arrangement-card__meta">6 门 · 16 学分</span>
              <span className="spotlight-tour__arrangement-conflict">{conflictCount} 冲突</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SpotlightTour({
  open,
  entryMode = 'manual',
  onFinish,
  onSkip,
  onStepAction,
}: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const [rects, setRects] = useState<SpotlightRect[]>([]);
  const [cardPosition, setCardPosition] = useState<CardPosition>({
    top: VIEWPORT_PADDING,
    left: VIEWPORT_PADDING,
    placement: 'center',
  });
  const [confirmSkipOpen, setConfirmSkipOpen] = useState(false);
  const [clickPoint, setClickPoint] = useState<ClickPoint | null>(null);
  const [entryAnimationStepId, setEntryAnimationStepId] = useState(FIRST_FLOAT_STEP_ID);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const actedStepRef = useRef('');
  const previousStepIndexRef = useRef(0);
  const step = tourSteps[stepIndex];

  const scrollTargetIntoView = useCallback((behavior?: ScrollBehavior) => {
    if (!open || typeof document === 'undefined') return;
    const [firstSelector] = stepSelectors(step);
    if (!firstSelector) return;
    const target = document.querySelector<HTMLElement>(firstSelector);
    target?.scrollIntoView({
      behavior: behavior ?? (prefersReducedMotion() ? 'auto' : 'smooth'),
      block: window.innerWidth <= 640 ? 'center' : 'nearest',
      inline: 'center',
    });
  }, [open, step]);

  const updateGeometry = useCallback(() => {
    if (!open || typeof document === 'undefined') return;

    const cardWidth = cardRef.current?.offsetWidth
      ?? Math.min(DESKTOP_CARD_WIDTH, window.innerWidth - VIEWPORT_PADDING * 2);
    const cardHeight = cardRef.current?.offsetHeight ?? DEFAULT_CARD_HEIGHT;
    const nextRects = getTargetRects(step);
    const nextFocusRect = unionRects(nextRects);

    setRects(nextRects);
    setCardPosition(cardPositionFor(nextFocusRect, step.placement, cardWidth, cardHeight));
  }, [open, step]);

  useLayoutEffect(() => {
    if (!open) return;
    setStepIndex(0);
    setRects([]);
    setCardPosition({
      top: VIEWPORT_PADDING,
      left: VIEWPORT_PADDING,
      placement: 'center',
    });
    setConfirmSkipOpen(false);
    setClickPoint(null);
    setEntryAnimationStepId(FIRST_FLOAT_STEP_ID);
    actedStepRef.current = '';
    previousStepIndexRef.current = 0;
  }, [open]);

  useEffect(() => {
    if (!open || typeof document === 'undefined') return undefined;

    const previousStepIndex = previousStepIndexRef.current;
    const movingForward = stepIndex > previousStepIndex;
    previousStepIndexRef.current = stepIndex;
    const timers: number[] = [];

    const scheduleGeometryUpdate = (delay: number) => {
      timers.push(window.setTimeout(() => {
        scrollTargetIntoView();
        timers.push(window.setTimeout(updateGeometry, prefersReducedMotion() ? 0 : 260));
      }, delay));
    };

    const runAction = () => {
      if (!step.action) return;
      onStepAction(step.action);
    };

    const actionKey = `${stepIndex}:${step.action ?? ''}`;
    if (step.action && actedStepRef.current !== actionKey) {
      actedStepRef.current = actionKey;
      const clickTarget = step.clickTarget
        ? document.querySelector<HTMLElement>(step.clickTarget)
        : null;
      if (movingForward && clickTarget && !prefersReducedMotion()) {
        const bounds = clickTarget.getBoundingClientRect();
        setClickPoint({
          key: actionKey,
          x: bounds.left + bounds.width / 2,
          y: bounds.top + bounds.height / 2,
        });
        timers.push(window.setTimeout(() => {
          runAction();
          setClickPoint(null);
          scheduleGeometryUpdate(280);
        }, 1000));
      } else {
        runAction();
        scheduleGeometryUpdate(step.action ? 280 : 0);
      }
    } else {
      scheduleGeometryUpdate(0);
    }

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [onStepAction, open, scrollTargetIntoView, step, stepIndex, updateGeometry]);

  useLayoutEffect(() => {
    if (open) updateGeometry();
  }, [open, stepIndex, updateGeometry]);

  useEffect(() => {
    if (!open || !cardRef.current || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => updateGeometry());
    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [open, updateGeometry]);

  useEffect(() => {
    if (!open) return undefined;
    let frame = 0;
    let resizeTimer = 0;
    const refresh = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(updateGeometry);
    };
    const refreshAfterResize = () => {
      scrollTargetIntoView('auto');
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(refresh, 0);
    };
    window.addEventListener('resize', refreshAfterResize);
    window.addEventListener('scroll', refresh, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(resizeTimer);
      window.removeEventListener('resize', refreshAfterResize);
      window.removeEventListener('scroll', refresh, true);
    };
  }, [open, scrollTargetIntoView, updateGeometry]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setConfirmSkipOpen(true);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onSkip, open]);

  if (!open || typeof document === 'undefined') return null;

  const moveToStep = (nextIndex: number) => {
    const boundedIndex = clamp(nextIndex, 0, tourSteps.length - 1);
    const nextStep = tourSteps[boundedIndex] ?? tourSteps[0];
    if (nextStep.entryAnimation === 'float') {
      setRects([]);
      setEntryAnimationStepId(nextStep.id);
    } else {
      setEntryAnimationStepId('');
    }
    setStepIndex(boundedIndex);
  };
  const goNext = () => moveToStep(stepIndex + 1);
  const goPrevious = () => moveToStep(stepIndex - 1);
  const restart = () => moveToStep(0);
  const skip = () => {
    setConfirmSkipOpen(true);
  };
  const maskId = `spotlight-tour-mask-${step.id}`;
  const hasTarget = stepSelectors(step).length > 0;
  const hasMeasuredTarget = !hasTarget || rects.length > 0;
  const shouldFloatCard = step.entryAnimation === 'float' && entryAnimationStepId === step.id;
  const cardVisible = !shouldFloatCard || hasMeasuredTarget;
  const arrangementPreviewRect = step.preview === 'arrangementPanel'
    ? getArrangementPreviewRect()
    : null;

  return createPortal(
    <div className={`spotlight-tour spotlight-tour--${entryMode}`}>
      {arrangementPreviewRect ? <ArrangementPanelPreview rect={arrangementPreviewRect} /> : null}
      <svg className="spotlight-tour__shade-svg" aria-hidden="true">
        <defs>
          <mask id={maskId}>
            <rect x="0" y="0" width="100%" height="100%" fill="#fff" />
            {rects.map((item, index) => (
              <rect
                key={index}
                x={item.left}
                y={item.top}
                width={item.width}
                height={item.height}
                rx="14"
                ry="14"
                fill="#000"
              />
            ))}
          </mask>
        </defs>
        <rect x="0" y="0" width="100%" height="100%" mask={`url(#${maskId})`} />
      </svg>
      {rects.map((item, index) => (
        <div
          key={index}
          className="spotlight-tour__highlight"
          style={{
            top: item.top,
            left: item.left,
            width: item.width,
            height: item.height,
          }}
        />
      ))}
      {clickPoint ? (
        <div
          className="spotlight-tour__cursor"
          key={clickPoint.key}
          style={{
            top: clickPoint.y,
            left: clickPoint.x,
          }}
          aria-hidden="true"
        >
          <span className="spotlight-tour__cursor-pointer" />
          <span className="spotlight-tour__cursor-ring" />
        </div>
      ) : null}
      <div
        ref={cardRef}
        className={[
          'spotlight-tour__card-wrap',
          `spotlight-tour__card-wrap--${cardPosition.placement}`,
          cardVisible ? '' : 'spotlight-tour__card-wrap--pending',
          shouldFloatCard && cardVisible ? 'spotlight-tour__card-wrap--float-in' : '',
        ].filter(Boolean).join(' ')}
        style={{
          top: cardPosition.top,
          left: cardPosition.left,
        }}
        role="dialog"
        aria-modal="true"
        aria-label="新手引导"
      >
        <TourCard
          step={step}
          index={stepIndex}
          total={tourSteps.length}
          onPrevious={goPrevious}
          onNext={goNext}
          onSkip={skip}
          onFinish={onFinish}
          onRestart={restart}
        />
      </div>
      <OnboardingConfirm
        open={confirmSkipOpen}
        title="跳过功能教学？"
        description="跳过后不会自动再次弹出，你仍然可以从“自定义”中重新查看。"
        confirmText="确认跳过"
        onCancel={() => setConfirmSkipOpen(false)}
        onConfirm={onSkip}
      />
    </div>,
    document.body,
  );
}
