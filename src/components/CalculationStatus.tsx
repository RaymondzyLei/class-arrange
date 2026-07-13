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
  const showAction = calculating
    || props.phase === 'error'
    || (props.phase === 'dirty' && props.mode === 'manual');

  return (
    <section
      className={`calculation-status calculation-status--${props.phase}`}
      role={props.phase === 'error' ? 'alert' : 'status'}
      aria-live="polite"
    >
      <span className="calculation-status__dot" aria-hidden="true" />
      <span className="calculation-status__message">{message}</span>
      {showAction ? (
        <Button
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
