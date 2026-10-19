/** How much to scale text so a line `contentWidth` wide fits in `availableWidth`, never below `minScale`. */
export function fitFontScale(contentWidth: number, availableWidth: number, minScale = 0.6): number {
  if (contentWidth <= 0 || availableWidth <= 0 || contentWidth <= availableWidth) return 1;
  return Math.max(minScale, availableWidth / contentWidth);
}
