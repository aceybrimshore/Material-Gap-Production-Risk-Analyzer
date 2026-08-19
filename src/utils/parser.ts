import Papa from 'papaparse';
import { 
  RiskLevel, 
  WorkOrderItem, 
  SummaryMetrics, 
  ComponentRollup, 
  AssemblyRollup, 
  ExpediteRecommendation,
  WorkOrderGroup,
  AssemblyGroup,
  PartialBuildOpportunity
} from '../types';

/**
 * Robust date parser handling D/M/YYYY, DD/MM/YYYY, YYYY-MM-DD, M/D/YYYY, etc.
 */
export function parseDateString(val: string | undefined | null): Date | null {
  if (!val) return null;
  const str = String(val).trim();
  if (!str || str === '- None -' || str === '-' || str === 'N/A') return null;

  // Handle D/M/YYYY or DD/MM/YYYY or DD-MM-YYYY
  const slashParts = str.split(/[/.-]/);
  if (slashParts.length === 3) {
    const p0 = parseInt(slashParts[0], 10);
    const p1 = parseInt(slashParts[1], 10);
    const p2 = parseInt(slashParts[2], 10);

    if (!isNaN(p0) && !isNaN(p1) && !isNaN(p2)) {
      // If p2 is 4 digits -> D/M/YYYY or M/D/YYYY
      if (p2 > 1000) {
        // Standard D/M/YYYY (Australia / UK / Manufacturing standard)
        return new Date(p2, p1 - 1, p0);
      }
      // If p0 is 4 digits -> YYYY-MM-DD
      if (p0 > 1000) {
        return new Date(p0, p1 - 1, p2);
      }
    }
  }

  const standardParsed = new Date(str);
  if (!isNaN(standardParsed.getTime())) {
    return standardParsed;
  }

  return null;
}

export function formatDateDisplay(date: Date | null, fallback = '-'): string {
  if (!date) return fallback;
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Check whether an item is considered Non-Material based on business rules:
 * - Inventory Type is "Non Inventory Item"
 * - Description or Item Code contains LABOUR CHARGE, Rework Placeholder, SERVICE, OVERHEAD, etc.
 */
export function checkIfNonMaterial(
  inventoryType: string,
  itemDescription: string,
  itemCode: string
): { isNonMaterial: boolean; reason?: string } {
  const invTypeClean = (inventoryType || '').trim().toLowerCase();
  const descClean = (itemDescription || '').trim().toLowerCase();
  const codeClean = (itemCode || '').trim().toLowerCase();

  // If Inventory Type is Component, Sub Assembly, or Raw Material, it is a real item requiring tracking/procurement
  // (e.g. L-M057C / LABOUR CHARGE MACHINE M057C is an outsourced machining component PO line that converts to M057C)
  if (invTypeClean === 'component' || invTypeClean === 'sub assembly' || invTypeClean === 'assembly' || invTypeClean === 'raw material') {
    if (descClean.includes('rework placeholder') || codeClean.includes('rework placeholder')) {
      return { isNonMaterial: true, reason: 'Rework Placeholder' };
    }
    return { isNonMaterial: false };
  }

  // Non Inventory items and Rework Placeholders
  if (invTypeClean.includes('non inventory') || invTypeClean.includes('non-inventory')) {
    return { isNonMaterial: true, reason: 'Inventory Type is Non Inventory Item' };
  }

  if (descClean.includes('rework placeholder') || codeClean.includes('rework placeholder')) {
    return { isNonMaterial: true, reason: 'Rework Placeholder' };
  }

  return { isNonMaterial: false };
}

/**
 * Parse raw CSV/TSV text into structured WorkOrderItem array with calculations
 */
export function parseWorkOrderCSV(rawText: string): WorkOrderItem[] {
  if (!rawText || !rawText.trim()) return [];

  const parsed = Papa.parse<Record<string, string>>(rawText.trim(), {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim()
  });

  const rows = parsed.data;
  const items: WorkOrderItem[] = [];

  rows.forEach((row, index) => {
    // Column header mapping flexibility
    const dateCreated = row['Date Created'] || row['DateCreated'] || row['Date'] || '';
    const woNumber = (row['WO Number'] || row['WONumber'] || row['WO'] || row['Work Order'] || `WO-${index + 1}`).trim();
    const assemblyItem = (row['Assembly Item'] || row['AssemblyItem'] || row['Assembly'] || row['Finished Good'] || '- None -').trim();
    const status = (row['Status'] || 'Released').trim();
    const prodStartDate = (row['Prod. Start Date'] || row['Prod Start Date'] || row['Production Start Date'] || row['StartDate'] || '').trim();
    const item = (row['Item'] || row['Item Code'] || row['Part Number'] || row['Component'] || '').trim();
    const lt = (row['L.T.'] || row['LT'] || row['Lead Time'] || '').trim();
    const customer = (row['Customer'] || '- None -').trim();
    const itemDescription = (row['Item Description'] || row['Description'] || row['Item Name'] || '').trim();
    
    const qtyNeededStr = (row['Qty Needed'] || row['QtyNeeded'] || row['Quantity Needed'] || '0').replace(/,/g, '').trim();
    const committedStr = (row['Committed'] || row['Qty Committed'] || '0').replace(/,/g, '').trim();
    const qtyVarStr = (row['Qty. Var.'] || row['Qty Var'] || row['Variance'] || row['Shortage'] || '').replace(/,/g, '').trim();
    
    const units = (row['Units'] || row['UOM'] || 'Each').trim();
    const assembly = (row['Assembly'] || '- None -').trim();
    const inventoryType = (row['Inventory Type'] || row['InventoryType'] || row['Type'] || 'Component').trim();
    const allocatedSupplyStr = (row['Allocated Supply'] || row['AllocatedSupply'] || '').replace(/,/g, '').trim();
    const maxSupplyReceiptDate = (row['Maximum of Supply Receipt Date'] || row['Max Supply Receipt Date'] || row['Supply Receipt Date'] || row['Supply Arrival Date'] || '').trim();
    const memberQuantityStr = (
      row['Assembly Item Member Quantity'] || 
      row['AssemblyItemMemberQuantity'] || 
      row['Assembly Item Member Qty'] || 
      row['Member Quantity'] || 
      row['Member Qty'] || 
      row['BOM Qty'] || 
      row['BOM Member Qty'] || 
      row['Qty Per Assembly'] || 
      ''
    ).replace(/,/g, '').trim();

    const qtyNeeded = parseFloat(qtyNeededStr) || 0;
    const committed = parseFloat(committedStr) || 0;
    // Calculate variance: if explicitly given use it, else Qty Needed - Committed
    const qtyVar = qtyVarStr !== '' ? parseFloat(qtyVarStr) || 0 : Math.max(0, qtyNeeded - committed);
    const allocatedSupply = allocatedSupplyStr !== '' ? parseFloat(allocatedSupplyStr) || null : null;
    const memberQuantity = memberQuantityStr !== '' ? parseFloat(memberQuantityStr) || null : null;

    // Evaluate Non-Material Rule
    const { isNonMaterial, reason } = checkIfNonMaterial(inventoryType, itemDescription, item);

    // Date calculations
    const prodStartDateParsed = parseDateString(prodStartDate);
    const supplyDateParsed = parseDateString(maxSupplyReceiptDate);
    
    // Check if Maximum of Supply Receipt Date is blank, empty, whitespace, or placeholder
    const isBlankSupplyDate = !maxSupplyReceiptDate || 
      maxSupplyReceiptDate.trim() === '' || 
      maxSupplyReceiptDate.trim() === '- None -' || 
      maxSupplyReceiptDate.trim() === '-' || 
      maxSupplyReceiptDate.trim() === 'N/A' ||
      maxSupplyReceiptDate.trim() === 'None';
      
    const isMissingSupplyDate = isBlankSupplyDate || !supplyDateParsed;

    let delayDays: number | null = null;
    if (prodStartDateParsed && supplyDateParsed) {
      const diffMs = supplyDateParsed.getTime() - prodStartDateParsed.getTime();
      delayDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    }

    // Determine Risk Level according to rules:
    // 🚨 Critical: High Qty. Var. AND supply date arrives after Prod. Start Date (or supply date is missing/blank).
    // ⚠️ Moderate: Material gap (Qty. Var. > 0), but supply date arrives on or before Prod. Start Date.
    // ✅ On Track: Qty. Var. is 0 or fully committed.
    let riskLevel: RiskLevel = 'ON_TRACK';

    if (isNonMaterial) {
      riskLevel = 'EXCLUDED';
    } else if (qtyVar > 0) {
      if (isMissingSupplyDate) {
        riskLevel = 'CRITICAL'; // Gap with no scheduled supply receipt date -> Need to create PO or check obsolete!
      } else if (delayDays !== null && delayDays > 0) {
        riskLevel = 'CRITICAL'; // Supply arrives after production start date
      } else {
        riskLevel = 'MODERATE'; // Supply scheduled on or before production start date
      }
    } else {
      riskLevel = 'ON_TRACK';
    }

    items.push({
      id: `item-${index}-${woNumber}-${item}`,
      dateCreated,
      woNumber,
      assemblyItem,
      status,
      prodStartDate,
      item,
      lt,
      customer,
      itemDescription,
      qtyNeeded,
      committed,
      qtyVar,
      units,
      assembly,
      inventoryType,
      allocatedSupply,
      maxSupplyReceiptDate,
      memberQuantity,
      isNonMaterial,
      exclusionReason: reason,
      riskLevel,
      prodStartDateParsed,
      supplyDateParsed,
      delayDays,
      isMissingSupplyDate
    });
  });

  return items;
}

/**
 * Compute Executive Summary Metrics
 */
export function calculateSummaryMetrics(items: WorkOrderItem[]): SummaryMetrics {
  const uniqueWOs = new Set<string>();
  const highRiskWOs = new Set<string>();
  const moderateRiskWOs = new Set<string>();
  const onTrackWOs = new Set<string>();

  let totalLineItems = items.length;
  let activeMaterialItems = 0;
  let excludedItems = 0;

  let criticalItemsCount = 0;
  let moderateItemsCount = 0;
  let onTrackItemsCount = 0;

  let criticalQtyVariance = 0;
  let moderateQtyVariance = 0;
  let totalQtyVariance = 0;

  let maxDelayDays = 0;
  let totalDelayDays = 0;
  let delayCount = 0;
  let missingSupplyDateCount = 0;

  items.forEach(item => {
    uniqueWOs.add(item.woNumber);

    if (item.isNonMaterial) {
      excludedItems++;
      return;
    }

    activeMaterialItems++;

    if (item.riskLevel === 'CRITICAL') {
      criticalItemsCount++;
      criticalQtyVariance += item.qtyVar;
      highRiskWOs.add(item.woNumber);

      if (item.isMissingSupplyDate) {
        missingSupplyDateCount++;
      }
      if (item.delayDays !== null && item.delayDays > 0) {
        if (item.delayDays > maxDelayDays) maxDelayDays = item.delayDays;
        totalDelayDays += item.delayDays;
        delayCount++;
      }
    } else if (item.riskLevel === 'MODERATE') {
      moderateItemsCount++;
      moderateQtyVariance += item.qtyVar;
      if (!highRiskWOs.has(item.woNumber)) {
        moderateRiskWOs.add(item.woNumber);
      }
    } else if (item.riskLevel === 'ON_TRACK') {
      onTrackItemsCount++;
    }

    totalQtyVariance += item.qtyVar;
  });

  // Calculate clean WO states
  uniqueWOs.forEach(wo => {
    if (!highRiskWOs.has(wo) && !moderateRiskWOs.has(wo)) {
      onTrackWOs.add(wo);
    }
  });

  const avgDelayDays = delayCount > 0 ? Math.round(totalDelayDays / delayCount) : 0;

  return {
    totalWOs: uniqueWOs.size,
    totalLineItems,
    activeMaterialItems,
    excludedItems,
    criticalItemsCount,
    moderateItemsCount,
    onTrackItemsCount,
    criticalQtyVariance,
    moderateQtyVariance,
    totalQtyVariance,
    highRiskWOsCount: highRiskWOs.size,
    moderateRiskWOsCount: moderateRiskWOs.size,
    onTrackWOsCount: onTrackWOs.size,
    maxDelayDays,
    avgDelayDays,
    missingSupplyDateCount
  };
}

/**
 * Group and aggregate by Component / Part Code to spot universal shortages
 */
export function aggregateByComponent(items: WorkOrderItem[]): ComponentRollup[] {
  const map = new Map<string, ComponentRollup>();

  items.filter(i => !i.isNonMaterial && i.qtyVar > 0).forEach(item => {
    const key = item.item || item.itemDescription;
    if (!key) return;

    if (!map.has(key)) {
      map.set(key, {
        itemCode: item.item,
        description: item.itemDescription,
        totalQtyNeeded: 0,
        totalCommitted: 0,
        totalQtyVar: 0,
        affectedWOs: [],
        affectedAssemblies: [],
        maxDelayDays: 0,
        riskLevel: 'ON_TRACK',
        supplyDates: [],
        earliestProdStartDate: item.prodStartDate
      });
    }

    const entry = map.get(key)!;
    entry.totalQtyNeeded += item.qtyNeeded;
    entry.totalCommitted += item.committed;
    entry.totalQtyVar += item.qtyVar;

    if (!entry.affectedWOs.includes(item.woNumber)) {
      entry.affectedWOs.push(item.woNumber);
    }
    if (item.assemblyItem && item.assemblyItem !== '- None -' && !entry.affectedAssemblies.includes(item.assemblyItem)) {
      entry.affectedAssemblies.push(item.assemblyItem);
    }
    if (item.maxSupplyReceiptDate && !entry.supplyDates.includes(item.maxSupplyReceiptDate)) {
      entry.supplyDates.push(item.maxSupplyReceiptDate);
    }

    if (item.riskLevel === 'CRITICAL') {
      entry.riskLevel = 'CRITICAL';
    } else if (entry.riskLevel !== 'CRITICAL' && item.riskLevel === 'MODERATE') {
      entry.riskLevel = 'MODERATE';
    }

    if (item.delayDays !== null && item.delayDays > entry.maxDelayDays) {
      entry.maxDelayDays = item.delayDays;
    }
  });

  return Array.from(map.values()).sort((a, b) => b.totalQtyVar - a.totalQtyVar);
}

/**
 * Group and aggregate by Assembly
 */
export function aggregateByAssembly(items: WorkOrderItem[]): AssemblyRollup[] {
  const map = new Map<string, AssemblyRollup>();

  items.filter(i => !i.isNonMaterial).forEach(item => {
    const key = item.assemblyItem || 'Generic';
    if (!map.has(key)) {
      map.set(key, {
        assemblyCode: key,
        woNumbers: [],
        totalShortageItems: 0,
        totalQtyVar: 0,
        hasCriticalShortage: false,
        earliestProdDate: item.prodStartDate,
        blockingItems: []
      });
    }

    const entry = map.get(key)!;
    if (!entry.woNumbers.includes(item.woNumber)) {
      entry.woNumbers.push(item.woNumber);
    }

    if (item.qtyVar > 0) {
      entry.totalShortageItems++;
      entry.totalQtyVar += item.qtyVar;
      if (!entry.blockingItems.includes(item.item)) {
        entry.blockingItems.push(item.item);
      }
    }

    if (item.riskLevel === 'CRITICAL') {
      entry.hasCriticalShortage = true;
    }
  });

  return Array.from(map.values()).sort((a, b) => b.totalQtyVar - a.totalQtyVar);
}

/**
 * Generate actionable expediting recommendations based on critical components
 */
export function generateExpediteRecommendations(items: WorkOrderItem[]): ExpediteRecommendation[] {
  const components = aggregateByComponent(items);
  const recs: ExpediteRecommendation[] = [];

  components.forEach(comp => {
    const isCritical = comp.riskLevel === 'CRITICAL';
    const isHighVolume = comp.totalQtyVar > 100 || comp.affectedWOs.length > 2;

    let criticality: 'URGENT' | 'HIGH' | 'MEDIUM' = 'MEDIUM';
    if (isCritical && isHighVolume) criticality = 'URGENT';
    else if (isCritical) criticality = 'HIGH';

    let suggestedAction = '';
    if (comp.supplyDates.length === 0 || comp.supplyDates.includes('Unconfirmed') || comp.supplyDates.some(d => !d || d === '- None -' || d.trim() === '')) {
      suggestedAction = `NO SUPPLY DATE (No PO on record). Action required: Create a Purchase Order (PO) immediately or investigate if this component is obsolete/superceded before production start ${comp.earliestProdStartDate}.`;
    } else if (comp.maxDelayDays > 0) {
      suggestedAction = `Expedite supply receipt from ${comp.supplyDates.join(', ')} to before target production start ${comp.earliestProdStartDate} (${comp.maxDelayDays} days late). Air freight or split shipment recommended.`;
    } else {
      suggestedAction = `Verify dock receipt and quality staging before ${comp.earliestProdStartDate} to prevent line stoppage.`;
    }

    recs.push({
      id: `rec-${comp.itemCode}`,
      itemCode: comp.itemCode,
      description: comp.description,
      totalShortage: comp.totalQtyVar,
      criticality,
      affectedWOCount: comp.affectedWOs.length,
      recommendedArrivalDate: comp.earliestProdStartDate,
      currentArrivalDate: comp.supplyDates.join(', ') || 'No Date (Unconfirmed)',
      impactedAssemblies: comp.affectedAssemblies,
      suggestedAction
    });
  });

  return recs.sort((a, b) => {
    const order = { URGENT: 0, HIGH: 1, MEDIUM: 2 };
    return order[a.criticality] - order[b.criticality];
  });
}

/**
 * Calculate greatest common divisor
 */
function gcd(a: number, b: number): number {
  a = Math.abs(Math.round(a));
  b = Math.abs(Math.round(b));
  while (b) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a;
}

/**
 * Find GCD across an array of numbers
 */
function findArrayGCD(numbers: number[]): number {
  if (numbers.length === 0) return 1;
  let result = Math.round(numbers[0]);
  for (let i = 1; i < numbers.length; i++) {
    result = gcd(result, numbers[i]);
    if (result === 1) break;
  }
  return result;
}

/**
 * Infer the target finished assembly quantity for a Work Order from its component lines.
 * Prioritizes explicit Assembly Item Member Quantity when provided in the CSV,
 * with GCD analysis as a robust fallback.
 */
export function inferWorkOrderTargetQuantity(materialItems: { qtyNeeded: number; memberQuantity?: number | null }[]): number {
  if (materialItems.length === 0) return 1;

  // 1. If explicit memberQuantity is provided on items, use it to accurately derive the target WO finished units
  const itemsWithMemberQty = materialItems.filter(i => (i.memberQuantity ?? 0) > 0 && i.qtyNeeded > 0);
  if (itemsWithMemberQty.length > 0) {
    const derivedTargets = itemsWithMemberQty.map(i => Math.round(i.qtyNeeded / (i.memberQuantity as number)));
    const validDerived = derivedTargets.filter(t => t > 0);
    if (validDerived.length > 0) {
      // Find the most frequent derived target quantity across the BOM lines
      const counts: Record<number, number> = {};
      validDerived.forEach(val => {
        counts[val] = (counts[val] || 0) + 1;
      });
      let bestTarget = validDerived[0];
      let maxCount = 0;
      Object.entries(counts).forEach(([valStr, count]) => {
        if (count > maxCount) {
          maxCount = count;
          bestTarget = parseInt(valStr, 10);
        }
      });
      return bestTarget;
    }
  }

  const positiveNeeded = materialItems.map(i => Math.round(i.qtyNeeded)).filter(q => q > 0);
  if (positiveNeeded.length === 0) return 1;
  
  // 2. Calculate GCD across all positive needed quantities
  const fullGCD = findArrayGCD(positiveNeeded);
  if (fullGCD > 1) {
    return fullGCD;
  }

  // 3. If full GCD is 1 (e.g. if one component is a 1-pack or 1-piece item while the batch is large),
  // inspect components with qtyNeeded > 1
  const multiNeeded = positiveNeeded.filter(q => q > 1);
  if (multiNeeded.length > 0) {
    const multiGCD = findArrayGCD(multiNeeded);
    if (multiGCD > 1) {
      return multiGCD;
    }
  }

  // Fallback to minimum positive qtyNeeded
  return Math.min(...positiveNeeded);
}

/**
 * Evaluates whether a Work Order with shortages can be reduced to partially build and satisfy customers immediately.
 * Uses exact Assembly Item Member Quantity (BOM requirement per finished assembly unit) to calculate
 * exact physical buildability from committed stock.
 */
export function evaluatePartialBuildOpportunity(wo: WorkOrderGroup): PartialBuildOpportunity | undefined {
  if (wo.allMaterialItems.length === 0 || wo.totalQtyVar === 0) {
    return undefined;
  }

  const materialItems = wo.allMaterialItems.filter(i => i.qtyNeeded > 0);
  if (materialItems.length === 0) return undefined;

  // Infer the base target finished goods quantity for this Work Order (e.g. 25 ladders, 84 kits, etc.)
  const targetWOQty = inferWorkOrderTargetQuantity(materialItems);
  if (targetWOQty <= 0) return undefined;

  // For every component, calculate how many finished assembly units can be built from its committed stock
  const partCapabilities = materialItems.map(item => {
    // Exact BOM multiplier: units of this part needed per 1 finished assembly
    const qtyPerAssembly = (item.memberQuantity && item.memberQuantity > 0)
      ? item.memberQuantity
      : (targetWOQty > 0 ? item.qtyNeeded / targetWOQty : 1);

    // How many finished assemblies can be built with the currently committed stock
    const buildableFromPart = qtyPerAssembly > 0 
      ? Math.floor(item.committed / qtyPerAssembly) 
      : item.committed;

    return {
      item,
      qtyPerAssembly,
      buildableFromPart,
      hasShortage: item.qtyVar > 0
    };
  });

  const limitingItems = materialItems.filter(i => i.qtyVar > 0);
  const fullyAvailable = materialItems.filter(i => i.qtyVar === 0);

  // Maximum finished units that can be built without exceeding ANY component's committed stock
  const maxBuildableQty = Math.min(...partCapabilities.map(p => p.buildableFromPart));

  // If maxBuildableQty is 0, at least one required component has insufficient/zero stock for even 1 unit
  if (maxBuildableQty <= 0) {
    return {
      isFeasible: false,
      originalTargetQty: targetWOQty,
      maxBuildableQty: 0,
      shortageQtyToSplit: targetWOQty,
      buildablePercentage: 0,
      limitingParts: limitingItems.map(i => ({
        itemCode: i.item,
        itemDescription: i.itemDescription,
        qtyNeeded: i.qtyNeeded,
        committed: i.committed,
        shortage: i.qtyVar,
        maxSupplyReceiptDate: i.maxSupplyReceiptDate || 'Unconfirmed'
      })),
      fullyAvailablePartsCount: fullyAvailable.length,
      totalMaterialPartsCount: materialItems.length,
      suggestionSummary: 'Not feasible for partial build: committed inventory is insufficient to assemble even 1 complete unit.'
    };
  }

  // If maxBuildableQty >= targetWOQty, all components are already sufficient
  if (maxBuildableQty >= targetWOQty) {
    return undefined;
  }

  const shortageQtyToSplit = Math.max(0, targetWOQty - maxBuildableQty);
  const buildablePercentage = Math.max(1, Math.round((maxBuildableQty / targetWOQty) * 100));

  // Sort limiting parts so that the tightest bottleneck (lowest buildable capability) appears first
  const sortedLimitingParts = partCapabilities
    .filter(p => p.hasShortage || p.buildableFromPart === maxBuildableQty)
    .sort((a, b) => a.buildableFromPart - b.buildableFromPart)
    .map(p => ({
      itemCode: p.item.item,
      itemDescription: p.item.itemDescription,
      qtyNeeded: p.item.qtyNeeded,
      committed: p.item.committed,
      shortage: p.item.qtyVar,
      maxSupplyReceiptDate: p.item.maxSupplyReceiptDate || 'Unconfirmed'
    }));

  return {
    isFeasible: true,
    originalTargetQty: targetWOQty,
    maxBuildableQty,
    shortageQtyToSplit,
    buildablePercentage,
    limitingParts: sortedLimitingParts,
    fullyAvailablePartsCount: fullyAvailable.length,
    totalMaterialPartsCount: materialItems.length,
    suggestionSummary: `Reduce WO to ${maxBuildableQty} units (${buildablePercentage}% buildable now). Split remaining ${shortageQtyToSplit} units into backorder.`
  };
}

/**
 * Group work order items into cohesive Work Order units with their missing/short components
 */
export function groupItemsByWorkOrder(items: WorkOrderItem[]): WorkOrderGroup[] {
  const map = new Map<string, WorkOrderGroup>();

  items.forEach(item => {
    // Unique key per WO
    const key = item.woNumber || 'Unknown_WO';
    if (!map.has(key)) {
      map.set(key, {
        id: `wogroup-${key}`,
        woNumber: item.woNumber,
        assemblyItem: item.assemblyItem,
        customer: item.customer,
        prodStartDate: item.prodStartDate,
        dateCreated: item.dateCreated,
        status: item.status,
        targetOrderQty: 0,
        overallRiskLevel: 'ON_TRACK',
        totalItemsCount: 0,
        shortageItemsCount: 0,
        totalQtyNeeded: 0,
        totalCommitted: 0,
        totalQtyVar: 0,
        maxDelayDays: null,
        hasMissingSupplyDate: false,
        shortItems: [],
        allMaterialItems: [],
        excludedItems: [],
      });
    }

    const group = map.get(key)!;
    group.totalItemsCount++;

    if (item.isNonMaterial) {
      group.excludedItems.push(item);
    } else {
      group.allMaterialItems.push(item);
      group.totalQtyNeeded += item.qtyNeeded;
      group.totalCommitted += item.committed;

      if (item.qtyVar > 0) {
        group.shortItems.push(item);
        group.shortageItemsCount++;
        group.totalQtyVar += item.qtyVar;

        if (item.isMissingSupplyDate) {
          group.hasMissingSupplyDate = true;
        }

        if (item.delayDays !== null) {
          if (group.maxDelayDays === null || item.delayDays > group.maxDelayDays) {
            group.maxDelayDays = item.delayDays;
          }
        }
      }
    }
  });

  // Calculate overall risk level and partial build opportunity for each work order
  map.forEach(group => {
    // Determine target finished goods units ordered for this WO
    const itemsForTarget = group.allMaterialItems.length > 0 ? group.allMaterialItems : group.excludedItems;
    group.targetOrderQty = inferWorkOrderTargetQuantity(itemsForTarget);

    const hasCritical = group.shortItems.some(i => i.riskLevel === 'CRITICAL');
    const hasModerate = group.shortItems.some(i => i.riskLevel === 'MODERATE');

    if (hasCritical) {
      group.overallRiskLevel = 'CRITICAL';
    } else if (hasModerate) {
      group.overallRiskLevel = 'MODERATE';
    } else if (group.allMaterialItems.length === 0 && group.excludedItems.length > 0) {
      group.overallRiskLevel = 'EXCLUDED';
    } else {
      group.overallRiskLevel = 'ON_TRACK';
    }

    // Evaluate Partial Build Feasibility
    group.partialBuild = evaluatePartialBuildOpportunity(group);
  });

  // Sort: Critical first (by max delay desc, then total shortage desc), then Moderate, then On Track
  return Array.from(map.values()).sort((a, b) => {
    const riskPriority: Record<RiskLevel, number> = {
      CRITICAL: 0,
      MODERATE: 1,
      ON_TRACK: 2,
      EXCLUDED: 3,
    };
    if (riskPriority[a.overallRiskLevel] !== riskPriority[b.overallRiskLevel]) {
      return riskPriority[a.overallRiskLevel] - riskPriority[b.overallRiskLevel];
    }
    const delayA = a.maxDelayDays !== null ? a.maxDelayDays : (a.overallRiskLevel === 'CRITICAL' ? 999 : -999);
    const delayB = b.maxDelayDays !== null ? b.maxDelayDays : (b.overallRiskLevel === 'CRITICAL' ? 999 : -999);
    if (delayA !== delayB) {
      return delayB - delayA;
    }
    return b.totalQtyVar - a.totalQtyVar;
  });
}

/**
 * Group work orders by finished Assembly item, with nested missing parts
 */
export function groupItemsByAssembly(items: WorkOrderItem[]): AssemblyGroup[] {
  const woGroups = groupItemsByWorkOrder(items);
  const assemblyMap = new Map<string, AssemblyGroup>();

  woGroups.forEach(wo => {
    const asmKey = wo.assemblyItem || 'Unassigned Assembly';
    if (!assemblyMap.has(asmKey)) {
      assemblyMap.set(asmKey, {
        id: `asmgroup-${asmKey}`,
        assemblyItem: asmKey,
        workOrders: [],
        overallRiskLevel: 'ON_TRACK',
        totalWOCount: 0,
        totalShortageItemsCount: 0,
        totalQtyNeeded: 0,
        totalCommitted: 0,
        totalQtyVar: 0,
        earliestProdStartDate: wo.prodStartDate,
        partialBuildAvailableCount: 0,
        uniqueMissingParts: [],
      });
    }

    const asm = assemblyMap.get(asmKey)!;
    asm.workOrders.push(wo);
    asm.totalWOCount++;
    asm.totalShortageItemsCount += wo.shortageItemsCount;
    asm.totalQtyNeeded += wo.totalQtyNeeded;
    asm.totalCommitted += wo.totalCommitted;
    asm.totalQtyVar += wo.totalQtyVar;

    if (wo.partialBuild?.isFeasible) {
      asm.partialBuildAvailableCount = (asm.partialBuildAvailableCount || 0) + 1;
    }

    // Earliest prod start date
    if (wo.prodStartDate && (!asm.earliestProdStartDate || wo.prodStartDate < asm.earliestProdStartDate)) {
      asm.earliestProdStartDate = wo.prodStartDate;
    }
  });

  // Calculate unique missing parts for each assembly
  assemblyMap.forEach(asm => {
    const partMap = new Map<string, {
      itemCode: string;
      itemDescription: string;
      totalQtyNeeded: number;
      totalCommitted: number;
      totalQtyVar: number;
      maxSupplyReceiptDate: string;
      delayDays: number | null;
      riskLevel: RiskLevel;
      wosAffected: string[];
    }>();

    asm.workOrders.forEach(wo => {
      wo.shortItems.forEach(item => {
        if (!partMap.has(item.item)) {
          partMap.set(item.item, {
            itemCode: item.item,
            itemDescription: item.itemDescription,
            totalQtyNeeded: 0,
            totalCommitted: 0,
            totalQtyVar: 0,
            maxSupplyReceiptDate: item.maxSupplyReceiptDate || 'Unconfirmed',
            delayDays: item.delayDays,
            riskLevel: item.riskLevel,
            wosAffected: [],
          });
        }

        const part = partMap.get(item.item)!;
        part.totalQtyNeeded += item.qtyNeeded;
        part.totalCommitted += item.committed;
        part.totalQtyVar += item.qtyVar;
        if (!part.wosAffected.includes(wo.woNumber)) {
          part.wosAffected.push(wo.woNumber);
        }
        if (item.riskLevel === 'CRITICAL') {
          part.riskLevel = 'CRITICAL';
        }
        if (item.delayDays !== null && (part.delayDays === null || item.delayDays > part.delayDays)) {
          part.delayDays = item.delayDays;
        }
      });
    });

    asm.uniqueMissingParts = Array.from(partMap.values()).sort((a, b) => b.totalQtyVar - a.totalQtyVar);

    // Overall assembly risk
    const hasCritical = asm.workOrders.some(w => w.overallRiskLevel === 'CRITICAL');
    const hasModerate = asm.workOrders.some(w => w.overallRiskLevel === 'MODERATE');
    if (hasCritical) asm.overallRiskLevel = 'CRITICAL';
    else if (hasModerate) asm.overallRiskLevel = 'MODERATE';
    else asm.overallRiskLevel = 'ON_TRACK';
  });

  return Array.from(assemblyMap.values()).sort((a, b) => {
    const riskPriority: Record<RiskLevel, number> = {
      CRITICAL: 0,
      MODERATE: 1,
      ON_TRACK: 2,
      EXCLUDED: 3,
    };
    if (riskPriority[a.overallRiskLevel] !== riskPriority[b.overallRiskLevel]) {
      return riskPriority[a.overallRiskLevel] - riskPriority[b.overallRiskLevel];
    }
    return b.totalQtyVar - a.totalQtyVar;
  });
}

