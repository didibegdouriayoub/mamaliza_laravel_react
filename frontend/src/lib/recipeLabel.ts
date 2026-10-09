/** Text shown for a recipe in every recipe dropdown: "Name — target 120 kg". */
export const recipeLabel = (r: { name: string; targetWeight?: number | string | null }): string => {
  const kg = Number(r.targetWeight) || 0;
  return kg ? `${r.name} — target ${kg} kg` : r.name;
};
