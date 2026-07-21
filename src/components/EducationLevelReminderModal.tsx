import BottomModal from './BottomModal';

const EDUCATION_LEVEL_REMINDER_BODY =
  '新增学历层次选项，请注意检查所选课堂为本科生课堂还是研究生课堂，本科生选研究生课请先联系开课单位研究生教学秘书设置本研同堂，再联系开课单位本科教学秘书设为参选。本科生只有选修本研贯通课程获得的学分，可作为本科生学士学位毕业有效学分。';

interface Props {
  open: boolean;
  onClose: () => void;
  afterClose: () => void;
}

export default function EducationLevelReminderModal({ open, onClose, afterClose }: Props) {
  return (
    <BottomModal
      open={open}
      title="提醒"
      onClose={onClose}
      afterClose={afterClose}
      width={640}
      className="education-level-reminder-modal"
      footer={(
        <button type="button" className="update-modal__confirm" onClick={onClose}>
          我已知晓
        </button>
      )}
    >
      <p>{EDUCATION_LEVEL_REMINDER_BODY}</p>
    </BottomModal>
  );
}
