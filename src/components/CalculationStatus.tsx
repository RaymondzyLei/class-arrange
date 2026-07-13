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
      return {
        title: '尚未选择课程',
        description: mode === 'auto'
          ? '选择课程后将自动生成课表。'
          : '选择课程后可手动开始排课。',
      };
    case 'dirty':
      return mode === 'manual'
        ? {
            title: '待重新计算',
            description: hasSnapshot
              ? '课程或偏好已变更，当前仍显示上次计算的课表。'
              : '课程已就绪，开始排课后才会生成课表。',
          }
        : {
            title: '排课内容已更新',
            description: hasSnapshot
              ? '正在准备重新计算，期间保留上次课表。'
              : '正在准备自动排课。',
          };
    case 'calculating':
      return {
        title: hasSnapshot ? '正在重新计算' : '正在排课',
        description: hasSnapshot
          ? '当前课表仍可查看，完成后将一次性替换。'
          : '正在生成合适的排课方案。',
      };
    case 'error':
      return {
        title: '排课计算失败',
        description: hasSnapshot
          ? `${error ?? '请稍后重试。'} 已保留上次课表。`
          : error ?? '请稍后重试。',
      };
    case 'ready':
      return {
        title: '排课结果已就绪',
        description: '当前课表来自最近一次成功计算。',
      };
  }
}

export default function CalculationStatus(props: Props) {
  const copy = statusCopy(props);
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
      <div className="calculation-status__copy">
        <strong>{copy.title}</strong>
        <span>{copy.description}</span>
      </div>
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
