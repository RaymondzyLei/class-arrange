/** 触发浏览器打印，打印结束后清理 body 上的 printing 标记 */
export function exportPrint(): void {
  document.body.classList.add('printing');
  let timer: ReturnType<typeof setTimeout> | null = null;
  const cleanup = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    document.body.classList.remove('printing');
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  // 兜底：若浏览器不支持 afterprint，1s 后清理
  timer = setTimeout(cleanup, 1000);
  window.print();
}
