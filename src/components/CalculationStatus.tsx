import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Button } from 'antd';
import type { ArrangementCalculationPhase } from '@/utils/arrangementCalculationState';
import type { CalculationMode } from '@/utils/customization';

interface Props {
  phase: ArrangementCalculationPhase;
  mode: CalculationMode;
  hasSnapshot: boolean;
  actionLabel: '开始排课' | '重新计算';
  error: string | null;
  onCalculate: () => void;
  compact?: boolean;
}

function statusCopy({ phase, mode, hasSnapshot, error }: Props) {
  switch (phase) {
    case 'empty':
      return mode === 'auto'
        ? '选择课程后将自动生成课表。'
        : '选择课程后可手动开始排课。';
    case 'dirty':
      return '课程或偏好已变更。';
    case 'calculating':
      return hasSnapshot
        ? '正在重新计算，当前课表仍可查看。'
        : '正在生成合适的排课方案。';
    case 'error':
      return hasSnapshot
        ? `${error ?? '排课计算失败，请稍后重试。'} 已保留上次课表。`
        : error ?? '排课计算失败，请稍后重试。';
    case 'ready':
      return '当前课表来自最近一次成功计算。';
  }
}

export default function CalculationStatus(props: Props) {
  const message = statusCopy(props);
  const calculating = props.phase === 'calculating';
  const messageViewportRef = useRef<HTMLSpanElement>(null);
  const messageContentRef = useRef<HTMLSpanElement>(null);
  const [scrollDistance, setScrollDistance] = useState(0);
  const showAction = calculating
    || props.phase === 'error'
    || (props.phase === 'dirty' && props.mode === 'manual');
  const messageStyle = scrollDistance > 0 ? {
    '--calculation-status-scroll-offset': `-${scrollDistance}px`,
    '--calculation-status-scroll-duration': `${Math.max(4, scrollDistance / 24)}s`,
  } as CSSProperties : undefined;

  useEffect(() => {
    const viewport = messageViewportRef.current;
    const content = messageContentRef.current;
    if (!viewport || !content) return undefined;

    const measure = () => {
      const distance = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
      setScrollDistance((current) => current === distance ? current : distance);
    };

    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;

    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    observer.observe(content);
    return () => observer.disconnect();
  }, [message, props.compact]);

  return (
    <section
      className={`calculation-status calculation-status--${props.phase}${props.compact ? ' calculation-status--compact' : ''}`}
      role={props.phase === 'error' ? 'alert' : 'status'}
      aria-live="polite"
    >
      <span className="calculation-status__dot" aria-hidden="true" />
      <span
        ref={messageViewportRef}
        className={`calculation-status__message${scrollDistance > 0 ? ' calculation-status__message--scrolling' : ''}`}
        style={messageStyle}
        title={message}
      >
        <span ref={messageContentRef} className="calculation-status__message-content">{message}</span>
      </span>
      {showAction ? (
        <Button
          size="small"
          type={props.phase === 'dirty' && !props.hasSnapshot ? 'primary' : 'default'}
          loading={calculating}
          disabled={calculating}
          onClick={props.onCalculate}
        >
          {props.actionLabel}
        </Button>
      ) : null}
    </section>
  );
}
