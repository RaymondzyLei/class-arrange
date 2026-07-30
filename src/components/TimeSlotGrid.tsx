import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react';
import { DAY_LABELS, DAYS, PERIODS } from '@/constants/grid';
import { blockedSlotKey } from '@/utils/customization';

export type TimeSlotCellState = 'empty' | 'blocked' | 'hard';

export interface TimeSlotPaintChange {
  key: string;
  state: TimeSlotCellState;
}

export interface TimeSlotGridHandle {
  flushPendingPaint: () => void;
}

interface Props {
  ariaLabel: string;
  getState: (key: string) => TimeSlotCellState;
  nextState: (state: TimeSlotCellState) => TimeSlotCellState;
  onPaint: (changes: readonly TimeSlotPaintChange[]) => void;
  stateLabels: Record<TimeSlotCellState, string>;
}

interface CellProps {
  cellKey: string;
  day: number;
  period: number;
  state: TimeSlotCellState;
  stateLabel: string;
}

const TimeSlotCell = memo(function TimeSlotCell({
  cellKey,
  day,
  period,
  state,
  stateLabel,
}: CellProps) {
  return (
    <td>
      <button
        type="button"
        data-slot-key={cellKey}
        data-slot-state={state}
        className={`availability-grid__cell availability-grid__cell--${state}`}
        aria-label={`${DAY_LABELS[day]}第 ${period} 节${stateLabel}`}
        aria-pressed={state !== 'empty'}
      />
    </td>
  );
});

const TimeSlotGrid = forwardRef<TimeSlotGridHandle, Props>(function TimeSlotGrid({
  ariaLabel,
  getState,
  nextState,
  onPaint,
  stateLabels,
}, ref) {
  const dragStateRef = useRef<{
    active: boolean;
    pointerId: number | null;
    targetState: TimeSlotCellState;
    lastKey: string;
  }>({
    active: false,
    pointerId: null,
    targetState: 'blocked',
    lastKey: '',
  });
  const lastPointerTypeRef = useRef('');
  const pendingPaintRef = useRef(new Map<string, TimeSlotCellState>());
  const paintFrameRef = useRef<number | null>(null);
  const onPaintRef = useRef(onPaint);
  const nextStateRef = useRef(nextState);
  onPaintRef.current = onPaint;
  nextStateRef.current = nextState;

  const commitPendingPaint = useCallback(() => {
    if (pendingPaintRef.current.size === 0) return;
    const changes = [...pendingPaintRef.current].map(([key, state]) => ({ key, state }));
    pendingPaintRef.current.clear();
    onPaintRef.current(changes);
  }, []);

  const flushPendingPaint = useCallback(() => {
    if (paintFrameRef.current !== null) {
      window.cancelAnimationFrame(paintFrameRef.current);
      paintFrameRef.current = null;
    }
    commitPendingPaint();
  }, [commitPendingPaint]);

  useImperativeHandle(ref, () => ({
    flushPendingPaint,
  }), [flushPendingPaint]);

  const queuePaint = useCallback((key: string, state: TimeSlotCellState) => {
    pendingPaintRef.current.set(key, state);
    if (paintFrameRef.current !== null) return;
    paintFrameRef.current = window.requestAnimationFrame(() => {
      paintFrameRef.current = null;
      commitPendingPaint();
    });
  }, [commitPendingPaint]);

  const stopDragging = useCallback((pointerId?: number) => {
    const drag = dragStateRef.current;
    if (!drag.active) return;
    if (pointerId !== undefined && drag.pointerId !== pointerId) return;
    flushPendingPaint();
    dragStateRef.current.active = false;
    dragStateRef.current.pointerId = null;
    dragStateRef.current.lastKey = '';
  }, [flushPendingPaint]);

  useEffect(() => {
    const stopPointerDragging = (event: PointerEvent) => {
      stopDragging(event.pointerId);
    };
    const stopAllDragging = () => stopDragging();
    window.addEventListener('pointerup', stopPointerDragging);
    window.addEventListener('pointercancel', stopPointerDragging);
    window.addEventListener('blur', stopAllDragging);
    return () => {
      window.removeEventListener('pointerup', stopPointerDragging);
      window.removeEventListener('pointercancel', stopPointerDragging);
      window.removeEventListener('blur', stopAllDragging);
      if (paintFrameRef.current !== null) {
        window.cancelAnimationFrame(paintFrameRef.current);
        paintFrameRef.current = null;
      }
      commitPendingPaint();
    };
  }, [commitPendingPaint, stopDragging]);

  return (
    <div className="availability-grid-card">
      <div className="availability-grid-wrap">
        <table
          className="availability-grid"
          aria-label={ariaLabel}
          onPointerMove={(event) => {
            const drag = dragStateRef.current;
            if (!drag.active || event.pointerId !== drag.pointerId) return;
            if ((event.buttons & 1) === 0) {
              stopDragging(event.pointerId);
              return;
            }
            const target = (event.target as HTMLElement)
              .closest<HTMLButtonElement>('[data-slot-key]');
            const key = target?.dataset.slotKey;
            if (!key || drag.lastKey === key) return;
            drag.lastKey = key;
            queuePaint(key, drag.targetState);
          }}
          onPointerDown={(event) => {
            const target = (event.target as HTMLElement)
              .closest<HTMLButtonElement>('[data-slot-key]');
            const key = target?.dataset.slotKey;
            const state = target?.dataset.slotState as TimeSlotCellState | undefined;
            if (!key || !state) return;
            lastPointerTypeRef.current = event.pointerType;
            if (event.pointerType !== 'mouse' || event.button !== 0) return;
            event.preventDefault();
            const targetState = nextStateRef.current(state);
            dragStateRef.current = {
              active: true,
              pointerId: event.pointerId,
              targetState,
              lastKey: key,
            };
            queuePaint(key, targetState);
          }}
          onClick={(event) => {
            const target = (event.target as HTMLElement)
              .closest<HTMLButtonElement>('[data-slot-key]');
            const key = target?.dataset.slotKey;
            const state = target?.dataset.slotState as TimeSlotCellState | undefined;
            if (!key || !state) return;
            if (event.detail === 0 || lastPointerTypeRef.current !== 'mouse') {
              onPaintRef.current([{ key, state: nextStateRef.current(state) }]);
            }
            lastPointerTypeRef.current = '';
          }}
          onDragStart={(event) => event.preventDefault()}
        >
          <thead>
            <tr>
              <th scope="col">节次</th>
              {DAYS.map((day) => <th scope="col" key={day}>{DAY_LABELS[day]}</th>)}
            </tr>
          </thead>
          <tbody>
            {PERIODS.map((period) => (
              <tr key={period}>
                <th scope="row">{period}</th>
                {DAYS.map((day) => {
                  const key = blockedSlotKey(day, period);
                  const state = getState(key);
                  return (
                    <TimeSlotCell
                      key={day}
                      cellKey={key}
                      day={day}
                      period={period}
                      state={state}
                      stateLabel={stateLabels[state]}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});

export default TimeSlotGrid;
