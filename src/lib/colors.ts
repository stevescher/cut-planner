/** Deterministic color palette for piece visualization */
const COLORS = [
  '#4F86C6', // steel blue
  '#E07A5F', // terra cotta
  '#81B29A', // sage
  '#F2CC8F', // sandy
  '#3D405B', // charcoal blue
  '#E9C46A', // gold
  '#264653', // dark teal
  '#E76F51', // burnt sienna
  '#2A9D8F', // teal
  '#F4A261', // sandy brown
  '#606C38', // olive
  '#BC6C25', // brown
  '#DDA15E', // tan
  '#283618', // dark olive
  '#457B9D', // french blue
  '#A8DADC', // powder blue
  '#1D3557', // navy
  '#E63946', // red
  '#588157', // forest
  '#A3B18A', // sage light
];

const MONO_COLORS = [
  '#E5E5E5',
  '#CCCCCC',
  '#B3B3B3',
  '#999999',
  '#D9D9D9',
  '#C0C0C0',
  '#A6A6A6',
  '#8C8C8C',
  '#D2D2D2',
  '#BFBFBF',
];

export function getColor(index: number, mono = false): string {
  const palette = mono ? MONO_COLORS : COLORS;
  return palette[index % palette.length];
}

export function getAllColors(): string[] {
  return [...COLORS];
}
