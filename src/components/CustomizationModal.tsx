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
import {
  PreferenceToggleButton as PreferenceToggle,
} from './onboarding/PreferenceSwitch';
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
  const [draftHardConflictSlots, setDraftHardConflictSlots] = useState(settings.hardConflictSlots);
  const hardConflictSlotSet = useMemo(() => new Set(draftHardConflictSlots), [draftHardConflictSlots]);
  const modalBodyRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<{ active: boolean; targetState: 'blocked' | 'hard' | 'empty'; lastKey: string }>({
    active: false,
    targetState: 'blocked',
    lastKey: '',
  });
  const lastGridPointerTypeRef = useRef('');

  useEffect(() => {
    if (!open) return;
    setDraftBlockedSlots(settings.blockedSlots);
    setDraftHardConflictSlots(settings.hardConflictSlots);
    setPage(initialPage);
  }, [initialPage, open, settings.blockedSlots, settings.hardConflictSlots]);

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

  const toggleSlot = (day: number, period: number) => {
    const key = blockedSlotKey(day, period);
    const current = hardConflictSlotSet.has(key) ? 'hard'
      : blockedSlotSet.has(key) ? 'blocked' : 'empty';
    const target = current === 'empty' ? 'blocked'
      : current === 'blocked' ? 'hard' : 'empty';
    setDraftBlockedSlots((cur) => {
      const next = new Set(cur);
      if (target === 'blocked') next.add(key); else next.delete(key);
      return [...next].sort();
    });
    setDraftHardConflictSlots((cur) => {
      const next = new Set(cur);
      if (target === 'hard') next.add(key); else next.delete(key);
      return [...next].sort();
    });
  };

  const paintSlot = (key: string, targetState: 'blocked' | 'hard' | 'empty') => {
    setDraftBlockedSlots((cur) => {
      const next = new Set(cur);
      if (targetState === 'blocked') next.add(key); else next.delete(key);
      return [...next].sort();
    });
    setDraftHardConflictSlots((cur) => {
      const next = new Set(cur);
      if (targetState === 'hard') next.add(key); else next.delete(key);
      return [...next].sort();
    });
  };

  const applySlots = () => {
    const blockedChanged = draftBlockedSlots.join('|') !== settings.blockedSlots.join('|');
    const hardChanged = draftHardConflictSlots.join('|') !== settings.hardConflictSlots.join('|');
    if (!blockedChanged && !hardChanged) return;
    onChange({ ...settings, blockedSlots: draftBlockedSlots, hardConflictSlots: draftHardConflictSlots });
  };

  const returnToMain = () => {
    applySlots();
    setPage('main');
  };

  const closeAndApply = () => {
    applySlots();
    onClose();
  };

  const calculationModeLabel = CALCULATION_MODE_OPTIONS.find(
    (option) => option.value === settings.calculationMode,
  )?.label ?? '自动排课';
  const blockedSlotsLabel = draftBlockedSlots.length > 0 || draftHardConflictSlots.length > 0
    ? `${draftBlockedSlots.length} 有事 / ${draftHardConflictSlots.length} 强冲突`
    : '未设置';

  return (
    <BottomModal
      className="customization-modal"
      open={open}
      title="自定义设置"
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
                <div className="customization__row customization__row--with-description">
                  <span className="customization__row-copy">
                    <span className="customization__row-title">优先避免跨校区</span>
                    <small className="customization__campus-transfer-description">
                      <span>
                        在冲突课程数尽可能少的前提下，跨校区次数越少越好。当前跨校区次数计算规则是：上午、下午、晚上分别从常驻地点出发，首课异地计1次，时段内（上午/下午/晚上）相邻课程换地区计1次，不计算返程。
                      </span>
                      <span>
                        需要注意的是：有相当多的课程上课地点不知道位于哪个校区，
                        <em>这可能会导致方案被错误排序</em>
                        ，请务必仔细检查。
                      </span>
                    </small>
                  </span>
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
                <p>点击循环切换 空闲 → 有事 → 强冲突 → 空闲；按住鼠标拖动可连续标注为按下时的目标状态。</p>
              </div>
              <Button
                disabled={draftBlockedSlots.length === 0 && draftHardConflictSlots.length === 0}
                onClick={() => {
                  setDraftBlockedSlots([]);
                  setDraftHardConflictSlots([]);
                }}
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
                    paintSlot(key, drag.targetState);
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
                          const key = blockedSlotKey(day, period);
                          const state = hardConflictSlotSet.has(key)
                            ? 'hard'
                            : blockedSlotSet.has(key) ? 'blocked' : 'empty';
                          return (
                            <td key={day}>
                              <button
                                type="button"
                                data-slot-key={blockedSlotKey(day, period)}
                                className={`availability-grid__cell availability-grid__cell--${state}`}
                                aria-label={`${DAY_LABELS[day]}第 ${period} 节${state === 'empty' ? '空闲' : state === 'blocked' ? '有事' : '强冲突'}`}
                                aria-pressed={state !== 'empty'}
                                onPointerDown={(event) => {
                                  lastGridPointerTypeRef.current = event.pointerType;
                                  if (event.pointerType !== 'mouse' || event.button !== 0) return;
                                  event.preventDefault();
                                  const key = blockedSlotKey(day, period);
                                  const current = hardConflictSlotSet.has(key)
                                    ? 'hard'
                                    : blockedSlotSet.has(key) ? 'blocked' : 'empty';
                                  const targetState = current === 'empty' ? 'blocked'
                                    : current === 'blocked' ? 'hard' : 'empty';
                                  dragStateRef.current = {
                                    active: true,
                                    targetState,
                                    lastKey: key,
                                  };
                                  paintSlot(key, targetState);
                                }}
                                onClick={(event) => {
                                  if (event.detail === 0 || lastGridPointerTypeRef.current !== 'mouse') {
                                    toggleSlot(day, period);
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
