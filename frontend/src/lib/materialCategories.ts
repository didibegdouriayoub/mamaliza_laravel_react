export type MaterialCategory = 'dairy_fat' | 'salt_emulsifier' | 'texture_filler' | 'additive';

// Raw material categories. Only dairy & fats carry fat % and protein % (per 100 g).
export const MATERIAL_CATEGORIES: { value: MaterialCategory; label: string }[] = [
  { value: 'dairy_fat', label: 'Dairy & fats' },
  { value: 'salt_emulsifier', label: 'Salts & emulsifiers' },
  { value: 'texture_filler', label: 'Texture & fillers' },
  { value: 'additive', label: 'Preservatives, flavours & colours' },
];

export const categoryLabel = (c?: string | null) => MATERIAL_CATEGORIES.find(x => x.value === c)?.label ?? '';
