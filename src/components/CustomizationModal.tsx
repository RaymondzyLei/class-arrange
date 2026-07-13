import { App, Button } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { DAYS, PERIODS, DAY_LABELS } from '@/constants/grid';
import {
  blockedSlotKey,
  type CustomScheduleSettings,
} from '@/utils/customization';
import BottomModal from './BottomModal';
import CalculationModePicker from './CalculationModePicker';
import { PreferenceSwitchVisual } from './onboarding/PreferenceSwitch';

interface Props {
  open: boolean;
  settings: CustomScheduleSettings;
  onChange: (settings: CustomScheduleSettings) => void;
  onClose: () => void;
  onRestartOnboarding: () => void;
}

function PreferenceToggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      className="customization__preference-toggle"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      onClick={() => onChange(!checked)}
    >
      <PreferenceSwitchVisual checked={checked} />
    </button>
  );
}

export default function CustomizationModal({
  open,
  settings,
  onChange,
  onClose,
  onRestartOnboarding,
}: Props) {
  const { message } = App.useApp();
  const [draftBlockedSlots, setDraftBlockedSlots] = useState(settings.blockedSlots);
  const blockedSlotSet = useMemo(() => new Set(draftBlockedSlots), [draftBlockedSlots]);
  const dragStateRef = useRef({ active: false, selecting: true, lastKey: '' });
  const lastGridPointerTypeRef = useRef('');

  useEffect(() => {
    if (open) setDraftBlockedSlots(settings.blockedSlots);
  }, [open, settings.blockedSlots]);

  useEffect(() => {
    const stopDragging = () => {
      dragStateRef.current.active = false;
      dragStateRef.current.lastKey = '';
    };
    window.addEventListener('pointerup', stopDragging);
    window.addEventListener('blur', stopDragging);
    return () => {
      window.removeEventListener('pointerup', stopDragging);
      window.removeEventListener('blur', stopDragging);
    };
  }, []);

  const setPreferHalfDay = (preferHalfDay: boolean) => {
    onChange({ ...settings, preferHalfDay });
    message.success('排课倾向已更新');
  };

  const setPreferFewerEarlyMornings = (preferFewerEarlyMornings: boolean) => {
    onChange({ ...settings, preferFewerEarlyMornings });
    message.success('排课倾向已更新');
  };

  const setCalculationMode = (calculationMode: CustomScheduleSettings['calculationMode']) => {
    if (calculationMode === settings.calculationMode) return;
    onChange({ ...settings, calculationMode });
    message.success('排课计算方式已更新');
  };

  const toggleBlockedSlot = (day: number, period: number) => {
    const key = blockedSlotKey(day, period);
    setDraftBlockedSlots((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return [...next].sort();
    });
  };

  const paintBlockedSlot = (key: string, selecting: boolean) => {
    setDraftBlockedSlots((current) => {
      const next = new Set(current);
      if (next.has(key) === selecting) return current;
      if (selecting) next.add(key);
      else next.delete(key);
      return [...next].sort();
    });
  };

  const closeAndApply = () => {
    if (draftBlockedSlots.join('|') !== settings.blockedSlots.join('|')) {
      onChange({ ...settings, blockedSlots: draftBlockedSlots });
    }
    onClose();
  };

  return (
    <BottomModal
      className="customization-modal"
      open={open}
      title="自定义"
      onClose={closeAndApply}
      width={820}
    >
      <div className="customization">
        <section className="customization__section customization__section--preferences" data-tour="customization-preferences">
          <div className="customization__section-head">
            <div>
              <h3>排课倾向</h3>
            </div>
          </div>
          <div className="customization__preference-list">
            <div className="customization__preference-row">
              <span className="customization__preference-label">优先空出半天</span>
              <PreferenceToggle
                checked={settings.preferHalfDay}
                label="优先空出半天"
                onChange={setPreferHalfDay}
              />
            </div>
            <div className="customization__preference-row">
              <span className="customization__preference-label">优先减少早八天数</span>
              <PreferenceToggle
                checked={settings.preferFewerEarlyMornings}
                label="优先减少早八天数"
                onChange={setPreferFewerEarlyMornings}
              />
            </div>
          </div>
        </section>

        <section className="customization__section" data-tour="customization-blocked-slots">
          <div className="customization__section-head customization__section-head--inline">
            <div>
              <h3>占位</h3>
              <p>点击或按住鼠标拖动选择时间；从已选格开始拖动可连续取消。</p>
            </div>
            <Button
              disabled={draftBlockedSlots.length === 0}
              onClick={() => setDraftBlockedSlots([])}
            >
              清空占位
            </Button>
          </div>
          <div className="availability-grid-wrap">
            <table
              className="availability-grid"
              onPointerMove={(event) => {
                const drag = dragStateRef.current;
                if (!drag.active) return;
                const target = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-slot-key]');
                const key = target?.dataset.slotKey;
                if (!key || drag.lastKey === key) return;
                drag.lastKey = key;
                paintBlockedSlot(key, drag.selecting);
              }}
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
                      const selected = blockedSlotSet.has(blockedSlotKey(day, period));
                      return (
                        <td key={day}>
                          <button
                            type="button"
                            data-slot-key={blockedSlotKey(day, period)}
                            className={`availability-grid__cell${selected ? ' availability-grid__cell--selected' : ''}`}
                            aria-label={`${DAY_LABELS[day]}第 ${period} 节${selected ? '有事' : '空闲'}`}
                            aria-pressed={selected}
                            onPointerDown={(event) => {
                              lastGridPointerTypeRef.current = event.pointerType;
                              if (event.pointerType !== 'mouse' || event.button !== 0) return;
                              event.preventDefault();
                              const key = blockedSlotKey(day, period);
                              dragStateRef.current = {
                                active: true,
                                selecting: !selected,
                                lastKey: key,
                              };
                              paintBlockedSlot(key, !selected);
                            }}
                            onClick={(event) => {
                              if (event.detail === 0 || lastGridPointerTypeRef.current !== 'mouse') {
                                toggleBlockedSlot(day, period);
                              }
                              lastGridPointerTypeRef.current = '';
                            }}
                            onDragStart={(event) => event.preventDefault()}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="customization__section customization__section--settings">
          <div className="customization__section-head customization__section-head--inline">
            <div>
              <h3>设置</h3>
              <p>选择修改课程或排课偏好后的计算方式。</p>
            </div>
            <Button onClick={onRestartOnboarding}>重新查看新手引导</Button>
          </div>
          <CalculationModePicker value={settings.calculationMode} onChange={setCalculationMode} />
        </section>
      </div>
    </BottomModal>
  );
}
