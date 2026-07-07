import { useState } from 'react';
import { Button, Dropdown, Input, App, type MenuProps } from 'antd';
import { usePlans } from '@/store/plansContext';
import type { Plan } from '@/types';
import { filterCurriculumOption, type CurriculumOption } from '@/utils/curriculum';
import { nextDuplicatePlanName } from '@/utils/planSeed';
import BottomModal from './BottomModal';
import { MoreIcon, PlusIcon, TrashIcon } from './icons';
import SelectWithChevron from './SelectWithChevron';

interface Props {
  curriculumOptions: CurriculumOption[];
  selectedCurriculumId: string | null;
  onCurriculumChange: (id: string | null) => void;
}

export default function PlanSwitcher({
  curriculumOptions,
  selectedCurriculumId,
  onCurriculumChange,
}: Props) {
  const { state, activePlan, dispatch } = usePlans();
  const { message } = App.useApp();
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Plan | null>(null);

  const switchTo = (id: string) => {
    if (id === activePlan?.id) return;
    const plan = state.plans.find((p) => p.id === id);
    dispatch({ type: 'switchPlan', id });
    if (plan) message.success(`已切换到「${plan.name}」`);
  };
  const create = () => {
    dispatch({ type: 'createPlan' });
    message.success('已新建方案');
  };
  const remove = (plan: Plan) => {
    dispatch({ type: 'deletePlan', id: plan.id });
    message.success(`已删除「${plan.name}」`);
  };
  const openRename = () => {
    if (!activePlan) return;
    setRenameValue(activePlan.name);
    setRenameOpen(true);
  };
  const confirmRename = () => {
    const name = renameValue.trim();
    if (!name) {
      message.warning('方案名不能为空');
      return;
    }
    if (state.plans.some((p) => p.id !== activePlan?.id && p.name === name)) {
      message.warning('方案名已存在');
      return;
    }
    if (activePlan) {
      dispatch({ type: 'renamePlan', id: activePlan.id, name });
      message.success(`已重命名为「${name}」`);
    }
    setRenameOpen(false);
  };
  const duplicate = () => {
    if (!activePlan) return;
    const name = nextDuplicatePlanName(activePlan.name, state.plans);
    dispatch({ type: 'duplicatePlan', id: activePlan.id });
    message.success(`已复制为「${name}」`);
  };
  const openDelete = (plan = activePlan) => {
    if (!plan) return;
    setDeleteTarget(plan);
    setDeleteOpen(true);
  };
  const confirmDelete = () => {
    if (deleteTarget) remove(deleteTarget);
    setDeleteTarget(null);
    setDeleteOpen(false);
  };
  const closeDelete = () => {
    setDeleteTarget(null);
    setDeleteOpen(false);
  };
  const planOptions = state.plans.map((plan) => ({
    value: plan.id,
    title: plan.name,
    label: (
      <span className={`plan-option${plan.id === activePlan?.id ? ' plan-option--active' : ''}`}>
        <span className="plan-option__name">{plan.name}</span>
        <button
          type="button"
          className="plan-option__delete"
          aria-label={`删除${plan.name}`}
          title={`删除${plan.name}`}
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            openDelete(plan);
          }}
        >
          <TrashIcon />
        </button>
      </span>
    ),
  }));
  const moreMenu: MenuProps = {
    items: [
      { key: 'rename', label: '重命名方案', disabled: !activePlan },
      { key: 'duplicate', label: '复制当前方案', disabled: !activePlan },
    ],
    onClick: ({ key }) => {
      if (key === 'rename') openRename();
      if (key === 'duplicate') duplicate();
    },
  };

  return (
    <div className="plan-switcher">
      <div className="plan-switcher__main-row">
        <span className="plan-switcher__label">我的方案</span>
        <SelectWithChevron
          className="plan-switcher__select"
          value={activePlan?.id}
          placeholder="请选择方案"
          onChange={switchTo}
          options={planOptions}
          optionLabelProp="title"
          popupClassName="plan-select-dropdown"
          disabled={state.plans.length === 0}
        />
        <div className="plan-switcher__actions">
          <Button
            className="plan-switcher__icon-button"
            aria-label="新建方案"
            title="新建方案"
            onClick={create}
            disabled={state.plans.length >= 10}
            icon={<PlusIcon />}
          />
          <Button
            className="plan-switcher__icon-button plan-switcher__icon-button--danger"
            aria-label="删除当前方案"
            title="删除当前方案"
            danger
            onClick={() => openDelete()}
            disabled={!activePlan || state.plans.length === 0}
            icon={<TrashIcon />}
          />
          <Dropdown menu={moreMenu} trigger={['click']} placement="bottomRight">
            <Button
              className="plan-switcher__icon-button"
              aria-label="更多方案操作"
              title="更多方案操作"
              disabled={!activePlan}
              icon={<MoreIcon />}
            />
          </Dropdown>
        </div>
      </div>
      <SelectWithChevron
        className="plan-switcher__curriculum-select"
        showSearch
        allowClear
        value={selectedCurriculumId ?? undefined}
        placeholder="选择或搜索培养方案"
        options={curriculumOptions}
        filterOption={filterCurriculumOption}
        optionFilterProp="label"
        popupClassName="curriculum-select-dropdown"
        popupMatchSelectWidth={520}
        onChange={(value) => onCurriculumChange(typeof value === 'string' ? value : null)}
      />
      <BottomModal
        title="重命名方案"
        open={renameOpen}
        onClose={() => setRenameOpen(false)}
        width={420}
        footer={(
          <>
            <Button onClick={() => setRenameOpen(false)}>取消</Button>
            <Button type="primary" onClick={confirmRename}>确定</Button>
          </>
        )}
      >
        <Input
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onPressEnter={confirmRename}
          maxLength={20}
          placeholder="方案名称"
          autoFocus
        />
      </BottomModal>
      <BottomModal
        title="删除当前方案？"
        open={deleteOpen}
        onClose={closeDelete}
        width={420}
        footer={(
          <>
            <Button onClick={closeDelete}>取消</Button>
            <Button danger type="primary" onClick={confirmDelete}>删除</Button>
          </>
        )}
      >
        <p className="bottom-modal__message">
          将删除「{deleteTarget?.name ?? ''}」。如果这是最后一个方案，系统会自动创建一个新的空方案。
        </p>
      </BottomModal>
      {!activePlan && (
        <div className="plan-switcher__hint">
          暂无方案，点击「新建」创建一个方案开始选课。
        </div>
      )}
    </div>
  );
}
