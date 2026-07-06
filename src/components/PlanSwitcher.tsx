import { useState } from 'react';
import { Button, Input, Space, App } from 'antd';
import { usePlans } from '@/store/plansContext';
import type { Plan } from '@/types';
import { filterCurriculumOption, type CurriculumOption } from '@/utils/curriculum';
import BottomModal from './BottomModal';
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

  const switchTo = (id: string) => dispatch({ type: 'switchPlan', id });
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
    if (activePlan) dispatch({ type: 'renamePlan', id: activePlan.id, name });
    setRenameOpen(false);
  };
  const duplicate = () => {
    if (activePlan) dispatch({ type: 'duplicatePlan', id: activePlan.id });
  };
  const openDelete = () => {
    if (!activePlan) return;
    setDeleteOpen(true);
  };
  const confirmDelete = () => {
    if (activePlan) remove(activePlan);
    setDeleteOpen(false);
  };

  return (
    <div className="plan-switcher">
      <span className="plan-switcher__label">我的方案</span>
      <SelectWithChevron
        className="plan-switcher__select"
        value={activePlan?.id}
        placeholder="请选择方案"
        onChange={switchTo}
        options={state.plans.map((p) => ({ label: p.name, value: p.id }))}
        disabled={state.plans.length === 0}
      />
      <SelectWithChevron
        className="plan-switcher__curriculum-select"
        showSearch
        allowClear
        value={selectedCurriculumId ?? undefined}
        placeholder="选择培养方案"
        options={curriculumOptions}
        filterOption={filterCurriculumOption}
        optionFilterProp="label"
        popupMatchSelectWidth={520}
        onChange={(value) => onCurriculumChange(typeof value === 'string' ? value : null)}
      />
      <Space size={4}>
        <Button size="small" onClick={create} disabled={state.plans.length >= 10}>
          新建
        </Button>
        <Button size="small" onClick={openRename} disabled={!activePlan}>
          重命名
        </Button>
        <Button size="small" onClick={duplicate} disabled={!activePlan}>
          复制
        </Button>
        <Button size="small" danger onClick={openDelete} disabled={!activePlan || state.plans.length === 0}>
          删除
        </Button>
      </Space>
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
        onClose={() => setDeleteOpen(false)}
        width={420}
        footer={(
          <>
            <Button onClick={() => setDeleteOpen(false)}>取消</Button>
            <Button danger type="primary" onClick={confirmDelete}>删除</Button>
          </>
        )}
      >
        <p className="bottom-modal__message">
          将删除「{activePlan?.name ?? ''}」。如果这是最后一个方案，系统会自动创建一个新的空方案。
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
