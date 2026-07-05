import { toPng } from 'html-to-image';

interface ExportTimetableOptions {
  planName: string;
  weekLabel: string;
}

function safeFileName(input: string): string {
  const trimmed = input.trim() || '选课方案';
  return trimmed.replace(/[\\/:*?"<>|]/g, '_');
}

export async function exportTimetableImage(
  target: HTMLElement,
  { planName, weekLabel }: ExportTimetableOptions,
): Promise<void> {
  const source = target.firstElementChild instanceof HTMLElement
    ? target.firstElementChild
    : target;
  const stage = document.createElement('div');
  const clone = source.cloneNode(true) as HTMLElement;

  stage.style.position = 'fixed';
  stage.style.left = '0';
  stage.style.top = '0';
  stage.style.zIndex = '-1';
  stage.style.width = '1800px';
  stage.style.padding = '20px';
  stage.style.boxSizing = 'border-box';
  stage.style.background = '#ffffff';
  stage.style.color = '#111111';
  stage.style.pointerEvents = 'none';
  stage.style.overflow = 'hidden';
  clone.style.width = '100%';
  stage.appendChild(clone);
  document.body.appendChild(stage);

  if (document.fonts) {
    await document.fonts.ready;
  }
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });

  const width = Math.ceil(stage.scrollWidth || stage.getBoundingClientRect().width || 1800);
  const height = Math.ceil(stage.scrollHeight || stage.getBoundingClientRect().height || 1);

  let dataUrl = '';
  try {
    dataUrl = await toPng(stage, {
      cacheBust: true,
      pixelRatio: 1.75,
      backgroundColor: '#ffffff',
      width,
      height,
      style: {
        background: '#ffffff',
        color: '#111111',
      },
    });
  } finally {
    stage.remove();
  }

  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = `${safeFileName(planName)}-${safeFileName(weekLabel)}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
