import { toPng, toJpeg } from 'html-to-image';

export async function exportElementAsPng(
  element: HTMLElement,
  filename: string = 'cut-planner-layout.png'
): Promise<void> {
  const dataUrl = await toPng(element, {
    backgroundColor: '#ffffff',
    pixelRatio: 2,
  });
  downloadDataUrl(dataUrl, filename);
}

export async function exportElementAsJpeg(
  element: HTMLElement,
  filename: string = 'cut-planner-layout.jpg'
): Promise<void> {
  const dataUrl = await toJpeg(element, {
    backgroundColor: '#ffffff',
    quality: 0.95,
    pixelRatio: 2,
  });
  downloadDataUrl(dataUrl, filename);
}

function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  link.click();
}
