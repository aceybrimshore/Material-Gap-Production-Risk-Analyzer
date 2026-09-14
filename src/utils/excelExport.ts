import { WorkOrderItem, WorkOrderGroup, AssemblyGroup } from '../types';

/**
 * Copy text to clipboard with standard navigator.clipboard and fallback
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // Fallback for non-secure contexts or older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      textArea.remove();
      return successful;
    }
  } catch (err) {
    console.error('Failed to copy text to clipboard:', err);
    return false;
  }
}

/**
 * Format a single Work Order group into clean Excel-ready Tab-Separated Values (TSV)
 */
export function formatWorkOrderForExcel(wo: WorkOrderGroup): string {
  const lines: string[] = [];

  const targetOrderQty = wo.targetOrderQty > 0 
    ? wo.targetOrderQty 
    : (wo.partialBuild?.originalTargetQty || '');
  const reduceToQty = wo.partialBuild?.isFeasible 
    ? wo.partialBuild.maxBuildableQty 
    : (wo.totalQtyVar === 0 ? targetOrderQty : 'N/A');
  const buildablePercent = wo.partialBuild?.isFeasible 
    ? `${wo.partialBuild.buildablePercentage}%` 
    : (wo.totalQtyVar === 0 ? '100%' : '0%');
  const splitQty = wo.partialBuild?.isFeasible 
    ? wo.partialBuild.shortageQtyToSplit 
    : 0;

  // Summary header block
  lines.push(`WORK ORDER ANALYSIS: ${wo.woNumber}`);
  lines.push(`Assembly Item:\t${wo.assemblyItem}`);
  lines.push(`Customer:\t${wo.customer || '- None -'}`);
  lines.push(`Target Production Start:\t${wo.prodStartDate || 'Unscheduled'}`);
  lines.push(`Target Order Qty (Units):\t${targetOrderQty}`);
  lines.push(`Reduce To Qty (Immediate Build):\t${reduceToQty}`);
  lines.push(`Buildable Percentage:\t${buildablePercent}`);
  lines.push(`Split / Backorder Qty:\t${splitQty}`);
  lines.push(`Overall Risk Level:\t${wo.overallRiskLevel}`);
  lines.push(`Total BOM Parts:\t${wo.allMaterialItems.length}`);
  lines.push(`Missing / Short Parts:\t${wo.shortageItemsCount}`);
  lines.push(`Total Shortage Gap (Units):\t-${wo.totalQtyVar}`);
  if (wo.partialBuild?.isFeasible) {
    lines.push(`Partial Build Suggestion:\t💡 REDUCE WO TO ${wo.partialBuild.maxBuildableQty} UNITS (${wo.partialBuild.buildablePercentage}% buildable immediately, split remaining ${wo.partialBuild.shortageQtyToSplit} units)`);
  }
  if (wo.hasMissingSupplyDate) {
    lines.push(`PO Status:\t🚨 NO SUPPLY DATE (PO Needed / Obsolete Verification Required)`);
  }
  lines.push(''); // Empty line before table

  // Table Column Headers
  lines.push([
    'WO Number',
    'Assembly Item',
    'Customer',
    'Target Prod Start',
    'Target Order Qty',
    'Reduce To Qty',
    'Buildable %',
    'Split Qty',
    'Component / Part #',
    'Item Description',
    'Member Qty (Per Unit)',
    'Qty Needed',
    'Committed',
    'Shortage Gap',
    'Inventory Type',
    'Supply Receipt Date',
    'Delay (Days)',
    'Schedule / PO Status',
    'Action Required'
  ].join('\t'));

  const items = wo.allMaterialItems.length > 0 ? wo.allMaterialItems : wo.excludedItems;

  items.forEach(item => {
    const isMissingDate = item.isMissingSupplyDate || !item.maxSupplyReceiptDate || item.maxSupplyReceiptDate === 'Unconfirmed';
    const supplyDate = isMissingDate ? 'NO SUPPLY DATE' : item.maxSupplyReceiptDate;
    const delayStr = isMissingDate 
      ? 'No PO on Record' 
      : item.delayDays !== null 
      ? (item.delayDays > 0 ? `+${item.delayDays}d Late` : (item.delayDays === 0 ? 'On Time' : `${Math.abs(item.delayDays)}d Early`))
      : 'Unscheduled';
    const actionStr = isMissingDate 
      ? 'Create PO / Check Obsolete' 
      : (item.riskLevel === 'CRITICAL' ? 'Expedite Vendor' : (item.riskLevel === 'MODERATE' ? 'Monitor Buffer' : 'On Track'));

    lines.push([
      wo.woNumber,
      wo.assemblyItem,
      wo.customer || '- None -',
      wo.prodStartDate || '',
      targetOrderQty,
      reduceToQty,
      buildablePercent,
      splitQty,
      item.item,
      item.itemDescription,
      item.memberQuantity !== null && item.memberQuantity !== undefined ? item.memberQuantity : '',
      item.qtyNeeded,
      item.committed,
      item.qtyVar > 0 ? -item.qtyVar : 0,
      item.inventoryType || 'Component',
      supplyDate,
      delayStr,
      isMissingDate ? 'NO SUPPLY DATE' : item.riskLevel,
      actionStr
    ].join('\t'));
  });

  return lines.join('\r\n');
}

/**
 * Format a single Assembly group into clean Excel-ready TSV
 */
export function formatAssemblyForExcel(asm: AssemblyGroup): string {
  const lines: string[] = [];

  // Summary header block
  lines.push(`ASSEMBLY ANALYSIS: ${asm.assemblyItem}`);
  lines.push(`Work Orders Count:\t${asm.totalWOCount}`);
  lines.push(`Earliest Production Start:\t${asm.earliestProdStartDate || 'N/A'}`);
  lines.push(`Overall Risk Level:\t${asm.overallRiskLevel}`);
  lines.push(`Total Units Needed:\t${asm.totalQtyNeeded}`);
  lines.push(`Total Units Committed:\t${asm.totalCommitted}`);
  lines.push(`Total Shortage Gap (Units):\t-${asm.totalQtyVar}`);
  lines.push(`Total Missing Parts Lines:\t${asm.totalShortageItemsCount}`);
  lines.push('');

  // Table Column Headers
  lines.push([
    'Assembly Item',
    'Component / Part #',
    'Item Description',
    'Total Qty Needed',
    'Total Committed',
    'Total Shortage Gap',
    'Supply Receipt Date',
    'Schedule / Delay Impact',
    'Risk Level',
    'Affected Work Orders'
  ].join('\t'));

  asm.uniqueMissingParts.forEach(part => {
    const isMissingDate = !part.maxSupplyReceiptDate || part.maxSupplyReceiptDate === 'Unconfirmed' || part.maxSupplyReceiptDate === 'NO SUPPLY DATE';
    const supplyDate = isMissingDate ? 'NO SUPPLY DATE' : part.maxSupplyReceiptDate;
    const delayStr = isMissingDate 
      ? 'No PO on Record (Create PO / Check Obsolete)' 
      : part.delayDays !== null 
      ? (part.delayDays > 0 ? `+${part.delayDays}d Late` : 'On Time')
      : 'Unscheduled';

    lines.push([
      asm.assemblyItem,
      part.itemCode,
      part.itemDescription,
      part.totalQtyNeeded,
      part.totalCommitted,
      part.totalQtyVar > 0 ? -part.totalQtyVar : 0,
      supplyDate,
      delayStr,
      part.riskLevel,
      part.wosAffected.join(', ')
    ].join('\t'));
  });

  return lines.join('\r\n');
}

/**
 * Format ALL filtered Work Orders into a consolidated Excel-ready TSV table
 */
export function formatAllWorkOrdersForExcel(wos: WorkOrderGroup[]): string {
  const lines: string[] = [];

  // Table Column Headers
  lines.push([
    'WO Number',
    'Assembly Item',
    'Customer',
    'Target Prod Start',
    'Target Order Qty',
    'Reduce To Qty',
    'Buildable %',
    'Split Qty',
    'Component / Part #',
    'Item Description',
    'Member Qty (Per Unit)',
    'Qty Needed',
    'Committed',
    'Shortage Gap',
    'Inventory Type',
    'Supply Receipt Date',
    'Delay (Days)',
    'Schedule Status',
    'Action Required'
  ].join('\t'));

  wos.forEach(wo => {
    const targetOrderQty = wo.targetOrderQty > 0 
      ? wo.targetOrderQty 
      : (wo.partialBuild?.originalTargetQty || '');
    const reduceToQty = wo.partialBuild?.isFeasible 
      ? wo.partialBuild.maxBuildableQty 
      : (wo.totalQtyVar === 0 ? targetOrderQty : '');
    const buildablePercent = wo.partialBuild?.isFeasible 
      ? `${wo.partialBuild.buildablePercentage}%` 
      : (wo.totalQtyVar === 0 ? '100%' : '');
    const splitQty = wo.partialBuild?.isFeasible 
      ? wo.partialBuild.shortageQtyToSplit 
      : (wo.totalQtyVar === 0 ? 0 : '');

    const items = wo.allMaterialItems.length > 0 ? wo.allMaterialItems : wo.excludedItems;
    items.forEach(item => {
      const isMissingDate = item.isMissingSupplyDate || !item.maxSupplyReceiptDate || item.maxSupplyReceiptDate === 'Unconfirmed';
      const supplyDate = isMissingDate ? 'NO SUPPLY DATE' : item.maxSupplyReceiptDate;
      const delayStr = isMissingDate 
        ? 'No PO on Record' 
        : item.delayDays !== null 
        ? (item.delayDays > 0 ? `+${item.delayDays}d Late` : (item.delayDays === 0 ? 'On Time' : `${Math.abs(item.delayDays)}d Early`))
        : 'Unscheduled';
      const actionStr = isMissingDate 
        ? 'Create PO / Check Obsolete' 
        : (item.riskLevel === 'CRITICAL' ? 'Expedite Vendor' : (item.riskLevel === 'MODERATE' ? 'Monitor Buffer' : 'On Track'));

      lines.push([
        wo.woNumber,
        wo.assemblyItem,
        wo.customer || '- None -',
        wo.prodStartDate || '',
        targetOrderQty,
        reduceToQty,
        buildablePercent,
        splitQty,
        item.item,
        item.itemDescription,
        item.memberQuantity !== null && item.memberQuantity !== undefined ? item.memberQuantity : '',
        item.qtyNeeded,
        item.committed,
        item.qtyVar > 0 ? -item.qtyVar : 0,
        item.inventoryType || 'Component',
        supplyDate,
        delayStr,
        isMissingDate ? 'NO SUPPLY DATE' : item.riskLevel,
        actionStr
      ].join('\t'));
    });
  });

  return lines.join('\r\n');
}

/**
 * Format ALL flat items into clean TSV
 */
export function formatAllItemsForExcel(items: WorkOrderItem[], woGroups?: WorkOrderGroup[]): string {
  const lines: string[] = [];

  const woMap = new Map<string, WorkOrderGroup>();
  if (woGroups) {
    woGroups.forEach(w => woMap.set(w.woNumber, w));
  }

  lines.push([
    'WO Number',
    'Assembly Item',
    'Customer',
    'Status',
    'Target Prod Start',
    'Target Order Qty',
    'Reduce To Qty',
    'Buildable %',
    'Split Qty',
    'Component / Part #',
    'Item Description',
    'Member Qty (Per Unit)',
    'Qty Needed',
    'Committed',
    'Shortage Gap (Qty Var)',
    'Units',
    'Inventory Type',
    'Supply Receipt Date',
    'Delay (Days)',
    'Schedule Risk',
    'Action Required'
  ].join('\t'));

  items.forEach(item => {
    const parentWO = woMap.get(item.woNumber);
    const targetOrderQty = parentWO?.targetOrderQty 
      ? parentWO.targetOrderQty 
      : (parentWO?.partialBuild?.originalTargetQty || '');
    const reduceToQty = parentWO?.partialBuild?.isFeasible 
      ? parentWO.partialBuild.maxBuildableQty 
      : (parentWO && parentWO.totalQtyVar === 0 ? targetOrderQty : '');
    const buildablePercent = parentWO?.partialBuild?.isFeasible 
      ? `${parentWO.partialBuild.buildablePercentage}%` 
      : (parentWO && parentWO.totalQtyVar === 0 ? '100%' : '');
    const splitQty = parentWO?.partialBuild?.isFeasible 
      ? parentWO.partialBuild.shortageQtyToSplit 
      : (parentWO && parentWO.totalQtyVar === 0 ? 0 : '');

    const isMissingDate = item.isMissingSupplyDate || !item.maxSupplyReceiptDate || item.maxSupplyReceiptDate === 'Unconfirmed';
    const supplyDate = isMissingDate ? 'NO SUPPLY DATE' : item.maxSupplyReceiptDate;
    const delayStr = isMissingDate 
      ? 'No PO on Record' 
      : item.delayDays !== null 
      ? (item.delayDays > 0 ? `+${item.delayDays}d Late` : (item.delayDays === 0 ? 'On Time' : `${Math.abs(item.delayDays)}d Early`))
      : 'Unscheduled';
    const actionStr = isMissingDate 
      ? 'Create PO / Check Obsolete' 
      : (item.riskLevel === 'CRITICAL' ? 'Expedite Vendor' : (item.riskLevel === 'MODERATE' ? 'Monitor Buffer' : 'On Track'));

    lines.push([
      item.woNumber,
      item.assemblyItem,
      item.customer || '- None -',
      item.status || 'Released',
      item.prodStartDate || '',
      targetOrderQty,
      reduceToQty,
      buildablePercent,
      splitQty,
      item.item,
      item.itemDescription,
      item.memberQuantity !== null && item.memberQuantity !== undefined ? item.memberQuantity : '',
      item.qtyNeeded,
      item.committed,
      item.qtyVar > 0 ? -item.qtyVar : 0,
      item.units || 'Each',
      item.inventoryType || 'Component',
      supplyDate,
      delayStr,
      isMissingDate ? 'NO SUPPLY DATE' : item.riskLevel,
      actionStr
    ].join('\t'));
  });

  return lines.join('\r\n');
}

/**
 * Format only Work Orders that qualify for Partial Build into an executive
 * reduction & split summary table for Excel (one row per Work Order)
 */
export function formatPartialBuildSummaryForExcel(wos: WorkOrderGroup[]): string {
  const lines: string[] = [];
  const eligibleWOs = wos.filter(w => w.partialBuild?.isFeasible);

  lines.push(`WORK ORDER REDUCTION & PARTIAL BUILD SUMMARY`);
  lines.push(`Export Date:\t${new Date().toLocaleDateString()}`);
  lines.push(`Eligible Work Orders:\t${eligibleWOs.length}`);
  lines.push('');

  lines.push([
    'WO Number',
    'Assembly Item',
    'Customer',
    'Target Prod Start',
    'Target Order Qty (Original)',
    'Reduce To Qty (Immediate Build)',
    'Buildable %',
    'Split Qty (Backorder WO)',
    'Bottleneck Part #',
    'Bottleneck Description',
    'Bottleneck Committed On Hand',
    'Bottleneck Supply ETA',
    'Schedule Status',
    'Recommended Production Action'
  ].join('\t'));

  eligibleWOs.forEach(wo => {
    const pb = wo.partialBuild!;
    const primaryLimiting = pb.limitingParts[0];
    const bottleneckPart = primaryLimiting ? primaryLimiting.itemCode : 'N/A';
    const bottleneckDesc = primaryLimiting ? primaryLimiting.itemDescription : 'None';
    const bottleneckCommitted = primaryLimiting ? primaryLimiting.committed : '';
    const bottleneckETA = primaryLimiting ? primaryLimiting.maxSupplyReceiptDate : 'N/A';
    const targetQty = wo.targetOrderQty > 0 ? wo.targetOrderQty : pb.originalTargetQty;

    lines.push([
      wo.woNumber,
      wo.assemblyItem,
      wo.customer || '- None -',
      wo.prodStartDate || 'Unscheduled',
      targetQty,
      pb.maxBuildableQty,
      `${pb.buildablePercentage}%`,
      pb.shortageQtyToSplit,
      bottleneckPart,
      bottleneckDesc,
      bottleneckCommitted,
      bottleneckETA,
      wo.maxDelayDays !== null && wo.maxDelayDays > 0 ? `+${wo.maxDelayDays}d Late` : 'On Track / Unscheduled',
      `Reduce WO to ${pb.maxBuildableQty} units; release shop floor build today. Split ${pb.shortageQtyToSplit} units to secondary WO awaiting ${bottleneckPart}.`
    ].join('\t'));
  });

  return lines.join('\r\n');
}

/**
 * Format simulated component coverage for a single Work Order partial build into Excel TSV
 */
export function formatPartialBuildCoverageForExcel(
  wo: WorkOrderGroup,
  simulatedQty: number,
  components: Array<{
    itemCode: string;
    description: string;
    unitMultiplier: number;
    committed: number;
    neededForSimulated: number;
    hasEnough: boolean;
    maxUnitsFromThisItem: number;
    supplyDate: string;
  }>
): string {
  const lines: string[] = [];
  const targetQty = wo.targetOrderQty > 0 ? wo.targetOrderQty : (wo.partialBuild?.originalTargetQty || '');
  const splitQty = typeof targetQty === 'number' ? Math.max(0, targetQty - simulatedQty) : '';

  lines.push(`WORK ORDER REDUCTION SIMULATION: ${wo.woNumber}`);
  lines.push(`Assembly Item:\t${wo.assemblyItem}`);
  lines.push(`Customer:\t${wo.customer || '- None -'}`);
  lines.push(`Target Production Start:\t${wo.prodStartDate || 'Unscheduled'}`);
  lines.push(`Original Target Qty:\t${targetQty}`);
  lines.push(`Simulated Reduce To Qty:\t${simulatedQty}`);
  lines.push(`Split / Backorder Qty:\t${splitQty}`);
  lines.push('');

  lines.push([
    'WO Number',
    'Assembly Item',
    'Original Target Qty',
    'Reduce To Qty',
    'Split Qty',
    'Component / Part #',
    'Item Description',
    'Qty / Unit (Member Qty)',
    'Committed On Hand',
    'Needed for Reduced Qty',
    'Coverage Status',
    'Max Units Buildable from Part',
    'Supply Receipt Date'
  ].join('\t'));

  components.forEach(c => {
    lines.push([
      wo.woNumber,
      wo.assemblyItem,
      targetQty,
      simulatedQty,
      splitQty,
      c.itemCode,
      c.description,
      c.unitMultiplier,
      c.committed,
      c.neededForSimulated,
      c.hasEnough ? 'Covered' : 'Short',
      c.maxUnitsFromThisItem,
      c.supplyDate
    ].join('\t'));
  });

  return lines.join('\r\n');
}
