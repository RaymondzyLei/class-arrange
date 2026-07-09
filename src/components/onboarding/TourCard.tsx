import { Button } from 'antd';
import type { TourStep } from '@/onboarding/tourSteps';

interface Props {
  step: TourStep;
  index: number;
  total: number;
  onPrevious: () => void;
  onNext: () => void;
  onSkip: () => void;
  onFinish: () => void;
  onRestart: () => void;
}

export default function TourCard({
  step,
  index,
  total,
  onPrevious,
  onNext,
  onSkip,
  onFinish,
  onRestart,
}: Props) {
  const isFirst = index === 0;
  const isLast = index === total - 1;
  const stepTotal = Math.max(total - 1, 1);

  return (
    <div className="tour-card">
      {!isLast ? <div className="tour-card__step">步骤 {index + 1} / {stepTotal}</div> : null}
      <h2 className="tour-card__title">{step.title}</h2>
      <p className="tour-card__description">{step.description}</p>
      {step.tip ? <p className="tour-card__tip">{step.tip}</p> : null}
      <div className="tour-card__actions">
        {!isFirst ? <Button onClick={onPrevious}>上一步</Button> : null}
        {!isLast ? <Button onClick={onSkip}>跳过引导</Button> : null}
        {isLast ? (
          <>
            <Button onClick={onRestart}>再看一遍</Button>
            <Button type="primary" onClick={onFinish}>开始使用</Button>
          </>
        ) : (
          <Button type="primary" onClick={onNext}>下一步</Button>
        )}
      </div>
    </div>
  );
}
