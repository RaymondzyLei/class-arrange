import { useState } from 'react';
import { Button, Input, Modal, Popconfirm, Select, Space, App } from 'antd';
import { usePlans } from '@/store/plansContext';
import type { Plan } from '@/types';

export default function PlanSwitcher() {
  const { state, activePlan, dispatch } = usePlans();
  const { message } = App.useApp();
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');

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

  return (
    <div
      className="panel-inner no-print"
      style={{ padding: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}
    >
      <span style={{ color: 'var(--text-sub)', whiteSpace: 'nowrap' }}>我的方案</span>
      <Select
        value={activePlan?.id}
        placeholder="请选择方案"
        style={{ flex: 1, minWidth: 120 }}
        onChange={switchTo}
        options={state.plans.map((p) => ({ label: `${p.name}（${p.courseIds.length}门）`, value: p.id }))}
        disabled={state.plans.length === 0}
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
        <Popconfirm
          title="删除当前方案？"
          onConfirm={() => activePlan && remove(activePlan)}
          disabled={!activePlan || state.plans.length === 0}
        >
          <Button size="small" danger disabled={!activePlan || state.plans.length === 0}>
            删除
          </Button>
        </Popconfirm>
      </Space>
      <Modal
        title="重命名方案"
        open={renameOpen}
        onOk={confirmRename}
        onCancel={() => setRenameOpen(false)}
        okText="确定"
        cancelText="取消"
      >
        <Input
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onPressEnter={confirmRename}
          maxLength={20}
          placeholder="方案名称"
          autoFocus
        />
      </Modal>
      {!activePlan && (
        <div style={{ width: '100%', textAlign: 'center', color: 'var(--text-sub)', padding: '4px 0' }}>
          暂无方案，点击「新建」创建一个方案开始选课。
        </div>
      )}
    </div>
  );
}
