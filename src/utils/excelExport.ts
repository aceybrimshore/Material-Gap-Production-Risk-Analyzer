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

  // Summary header block
  lines.push(`WORK ORDER ANALYSIS: ${wo.woNumber}`);
  lines.push(`Assembly Item:\t${wo.assemblyItem}`);
  lines.push(`Customer:\t${wo.customer || '- None -'}`);
  lines.push(`Target Production Start:\t${wo.prodStartDate || 'Unscheduled'}`);
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
    'Component / Part #',
    'Item Description',
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
        item.item,
        item.itemDescription,
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
export function formatAllItemsForExcel(items: WorkOrderItem[]): string {
  const lines: string[] = [];

  lines.push([
    'WO Number',
    'Assembly Item',
    'Customer',
    'Status',
    'Target Prod Start',
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
