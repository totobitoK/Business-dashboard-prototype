/** Row padding and type scale based on how many items are shown in operations lists. */
export function getOperationsListDensity(totalRows: number) {
  if (totalRows <= 3) {
    return {
      rowPy: "py-3",
      text: "text-sm",
      meta: "text-xs",
      header: "text-xs",
      maxVisible: totalRows,
    };
  }
  if (totalRows <= 6) {
    return {
      rowPy: "py-2.5",
      text: "text-xs",
      meta: "text-[11px]",
      header: "text-[10px]",
      maxVisible: totalRows,
    };
  }
  return {
    rowPy: "py-2",
    text: "text-[11px]",
    meta: "text-[10px]",
    header: "text-[10px]",
    maxVisible: 7,
  };
}
