import { App, Button } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { DAYS, PERIODS, DAY_LABELS } from '@/constants/grid';
import {
  ARRANGEMENT_DISPLAY_COUNT_OPTIONS,
  blockedSlotKey,
  CALCULATION_MODE_OPTIONS,
  RESIDENT_CAMPUS_OPTIONS,
  type ArrangementDisplayCount,
  type CustomScheduleSettings,
} from '@/utils/customization';
import type { ResidentCampus } from '@/types';
import BottomModal from './BottomModal';
import CalculationModePicker from './CalculationModePicker';
import { PreferenceSwitchVisual } from './onboarding/PreferenceSwitch';
import SelectWithChevron from './SelectWithChevron';

export type CustomizationPage = 'main' | 'blockedSlots' | 'calculationMode';

interface Props {
  open: boolean;
  settings: CustomScheduleSettings;
  onChange: (settings: CustomScheduleSettings) => void;
  onClose: () => void;
  onRestartOnboarding: () => void;
  showUpdatePopup: boolean;
  onShowUpdatePopupChange: (show: boolean) => void;
  onOpenUpdateHistory: () => void;
  initialPage?: CustomizationPage;
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

function NavigationRow({
  title,
  description,
  value,
  onClick,
}: {
  title: string;
  description?: string;
  value?: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="customization__navigation-row" onClick={onClick}>
      <span className="customization__row-copy">
        <span className="customization__row-title">{title}</span>
        {description ? <small>{description}</small> : null}
      </span>
      <span className="customization__navigation-value">
        {value ? <span>{value}</span> : null}
        <span className="customization__chevron" aria-hidden="true">›</span>
      </span>
    </button>
  );
}

export default function CustomizationModal({
  open,
  settings,
  onChange,
  onClose,
  onRestartOnboarding,
  showUpdatePopup,
  onShowUpdatePopupChange,
  onOpenUpdateHistory,
  initialPage = 'main',
}: Props) {
  const { message } = App.useApp();
  const [page, setPage] = useState<CustomizationPage>(initialPage);
  const [draftBlockedSlots, setDraftBlockedSlots] = useState(settings.blockedSlots);
  const blockedSlotSet = useMemo(() => new Set(draftBlockedSlots), [draftBlockedSlots]);
  const modalBodyRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef({ active: false, selecting: true, lastKey: '' });
  const lastGridPointerTypeRef = useRef('');

  useEffect(() => {
    if (!open) return;
    setDraftBlockedSlots(settings.blockedSlots);
    setPage(initialPage);
  }, [initialPage, open, settings.blockedSlots]);

  useEffect(() => {
    if (!open) return;
    modalBodyRef.current?.scrollTo({ top: 0 });
  }, [open, page]);

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

  const setPreferAvoidCampusTransfers = (preferAvoidCampusTransfers: boolean) => {
    onChange({ ...settings, preferAvoidCampusTransfers });
    message.success('排课倾向已更新');
  };

  const setResidentCampus = (residentCampus: ResidentCampus) => {
    if (residentCampus === settings.residentCampus) return;
    onChange({ ...settings, residentCampus });
    message.success('常驻地点已更新');
  };

  const setCalculationMode = (calculationMode: CustomScheduleSettings['calculationMode']) => {
    if (calculationMode === settings.calculationMode) return;
    onChange({ ...settings, calculationMode });
    message.success('排课计算方式已更新');
  };

  const setMergeAllTimeGroups = (mergeAllTimeGroups: boolean) => {
    onChange({ ...settings, mergeAllTimeGroups });
    message.success('课程时间组显示已更新');
  };

  const setArrangementDisplayCount = (arrangementDisplayCount: ArrangementDisplayCount) => {
    if (arrangementDisplayCount === settings.arrangementDisplayCount) return;
    onChange({ ...settings, arrangementDisplayCount });
    message.success('排课方案展示数量已更新');
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

  const applyBlockedSlots = () => {
    if (draftBlockedSlots.join('|') === settings.blockedSlots.join('|')) return;
    onChange({ ...settings, blockedSlots: draftBlockedSlots });
  };

  const returnToMain = () => {
    applyBlockedSlots();
    setPage('main');
  };

  const closeAndApply = () => {
    applyBlockedSlots();
    onClose();
  };

  const calculationModeLabel = CALCULATION_MODE_OPTIONS.find(
    (option) => option.value === settings.calculationMode,
  )?.label ?? '自动排课';
  const blockedSlotsLabel = draftBlockedSlots.length > 0
    ? `已选择 ${draftBlockedSlots.length} 个时段`
    : '未设置';

  return (
    <BottomModal
      className="customization-modal"
      open={open}
      title="自定义"
      headerLeading={page === 'main' ? undefined : (
        <button type="button" className="customization__back" onClick={returnToMain}>
          <span aria-hidden="true">‹</span> 返回
        </button>
      )}
      onClose={closeAndApply}
      width={820}
      bodyRef={modalBodyRef}
    >
      <div className={`customization customization--${page}`}>
        {page === 'main' ? (
          <>
            <section className="customization__group-section" data-tour="customization-preferences">
              <h3 className="customization__group-label">排课倾向</h3>
              <div className="customization__group">
                <div className="customization__row">
                  <span className="customization__row-title">优先避免跨校区</span>
                  <PreferenceToggle
                    checked={settings.preferAvoidCampusTransfers}
                    label="优先避免跨校区"
                    onChange={setPreferAvoidCampusTransfers}
                  />
                </div>
                <div className="customization__row">
                  <span className="customization__row-title">常驻地点</span>
                  <SelectWithChevron
                    aria-label="常驻地点"
                    className="customization__resident-select"
                    value={settings.residentCampus}
                    options={RESIDENT_CAMPUS_OPTIONS.map((option) => ({ ...option }))}
                    disabled={!settings.preferAvoidCampusTransfers}
                    onChange={(residentCampus) => setResidentCampus(residentCampus as ResidentCampus)}
                  />
                </div>
                <div className="customization__row">
                  <span className="customization__row-title">优先空出半天</span>
                  <PreferenceToggle
                    checked={settings.preferHalfDay}
                    label="优先空出半天"
                    onChange={setPreferHalfDay}
                  />
                </div>
                <div className="customization__row">
                  <span className="customization__row-title">优先减少早八天数</span>
                  <PreferenceToggle
                    checked={settings.preferFewerEarlyMornings}
                    label="优先减少早八天数"
                    onChange={setPreferFewerEarlyMornings}
                  />
                </div>
              </div>
            </section>

            <section className="customization__group-section">
              <h3 className="customization__group-label">课表生成</h3>
              <div className="customization__group">
                <NavigationRow
                  title="占位时间"
                  description="设置不方便上课的时间"
                  value={blockedSlotsLabel}
                  onClick={() => setPage('blockedSlots')}
                />
                <NavigationRow
                  title="排课计算方式"
                  value={calculationModeLabel}
                  onClick={() => setPage('calculationMode')}
                />
                <div className="customization__row">
                  <span className="customization__row-title">展示排课方案数量</span>
                  <SelectWithChevron
                    aria-label="展示排课方案数量"
                    className="customization__arrangement-count-select"
                    value={settings.arrangementDisplayCount}
                    options={ARRANGEMENT_DISPLAY_COUNT_OPTIONS.map((option) => ({ ...option }))}
                    onChange={(value) => setArrangementDisplayCount(value as ArrangementDisplayCount)}
                  />
                </div>
                <div className="customization__row">
                  <span className="customization__row-copy">
                    <span className="customization__row-title">合并课程所有时间组</span>
                    <small>开启后，课程列表中每门课程只显示一张卡片，时间组在详情中查看。</small>
                  </span>
                  <PreferenceToggle
                    checked={settings.mergeAllTimeGroups}
                    label="合并课程所有时间组"
                    onChange={setMergeAllTimeGroups}
                  />
                </div>
              </div>
            </section>

            <section className="customization__group-section">
              <h3 className="customization__group-label">通知与帮助</h3>
              <div className="customization__group">
                <div className="customization__row">
                  <span className="customization__row-copy">
                    <span className="customization__row-title">显示更新内容弹窗</span>
                    <small>关闭后，课程删除等重要变化仍会强制提醒。</small>
                  </span>
                  <PreferenceToggle
                    checked={showUpdatePopup}
                    label="显示更新内容弹窗"
                    onChange={onShowUpdatePopupChange}
                  />
                </div>
                <NavigationRow title="更新记录" onClick={onOpenUpdateHistory} />
                <NavigationRow title="重新查看新手引导" onClick={onRestartOnboarding} />
              </div>
            </section>
          </>
        ) : null}

        {page === 'blockedSlots' ? (
          <div className="customization__subpage" data-tour="customization-blocked-slots">
            <div className="customization__subpage-header">
              <div className="customization__subpage-copy">
                <h3>占位时间</h3>
                <p>点击或按住鼠标拖动选择时间；从已选格开始拖动可连续取消。</p>
              </div>
              <Button
                disabled={draftBlockedSlots.length === 0}
                onClick={() => setDraftBlockedSlots([])}
              >
                清空占位
              </Button>
            </div>
            <div className="customization__subpage-card">
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
            </div>
          </div>
        ) : null}

        {page === 'calculationMode' ? (
          <div className="customization__subpage">
            <div className="customization__subpage-header">
              <div className="customization__subpage-copy">
                <h3>排课计算方式</h3>
                <p>选择修改课程或排课偏好后的计算方式。</p>
              </div>
            </div>
            <CalculationModePicker value={settings.calculationMode} onChange={setCalculationMode} />
          </div>
        ) : null}
      </div>
    </BottomModal>
  );
}
