/** Natural tint of each need, in turn: [background, ink]. Same order on the home tiles and the need pages. */
export const needTints = [["#E3EFDC", "#2E5E2B"], ["#FBF0D9", "#8A5A00"], ["#EEF4E4", "#3E7B3A"], ["#F5E9DC", "#8A4B1C"], ["#E7F0E6", "#2E5E2B"], ["#F7EFD3", "#7A5B12"]] as const;

export function needTint(index: number) {
  return needTints[(index < 0 ? 0 : index) % needTints.length];
}
