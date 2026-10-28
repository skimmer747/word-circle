/**
 * Opens the iPad's photo picker (Photo Library, Take Photo, Choose File). Call it straight from a tap: the iPad only
 * opens it then. Resolves with the chosen photos, or none if the picker was cancelled (older iPads don't say, and
 * then it never resolves, which is harmless: nothing waits on it).
 */
export function pickPhotos(multiple: boolean): Promise<File[]> {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.multiple = multiple;
  // In the page but out of sight: some iPads won't open a picker for a hidden (display: none) input.
  input.className = 'photo-input';
  document.body.append(input);
  return new Promise((resolve) => {
    const finish = (files: File[]) => {
      input.remove();
      resolve(files);
    };
    input.addEventListener('change', () => finish([...(input.files ?? [])]), { once: true });
    input.addEventListener('cancel', () => finish([]), { once: true });
    input.click();
  });
}
