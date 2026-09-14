// Client-side fallback generators for GitHub Pages / static hosting environments
// Ensures complete functionality even when running without a Node.js Express backend

export function generateClientSupplyChainAnalysis(summary: any, criticalItems: any[] = [], topBottlenecks: any[] = []) {
  const totalWOs = summary?.totalWOs || 0;
  const criticalItemsCount = summary?.criticalItemsCount || 0;
  const highRiskWOsCount = summary?.highRiskWOsCount || 0;
  const maxDelayDays = summary?.maxDelayDays || 0;
  const totalQtyVariance = summary?.totalQtyVariance || 0;
  const missingDatesCount = summary?.missingSupplyDateCount || 0;

  const topPart = topBottlenecks && topBottlenecks.length > 0 ? topBottlenecks[0] : null;
  const secondPart = topBottlenecks && topBottlenecks.length > 1 ? topBottlenecks[1] : null;

  const executiveBrief = `Analysis of ${totalWOs} Work Orders identified ${criticalItemsCount} critical material shortages causing schedule delays up to ${maxDelayDays > 0 ? `+${maxDelayDays} days` : '0 days'}. Total uncommitted material variance is ${totalQtyVariance.toLocaleString()} units across ${highRiskWOsCount} blocked assembly work orders.${topPart ? ` Component ${topPart.itemCode} (${topPart.description}) represents the primary line-stoppage risk with ${topPart.totalQtyVar.toLocaleString()} units short across ${topPart.affectedWOs?.length || 1} work orders.` : ''}`;

  const keyRisks: string[] = [];
  if (topPart) {
    keyRisks.push(`Primary hardware bottleneck on part ${topPart.itemCode} (${topPart.description}): ${topPart.totalQtyVar.toLocaleString()} units short impacting ${topPart.affectedWOs?.length || 1} Work Orders (${(topPart.affectedWOs || []).slice(0, 4).join(', ')}).`);
  }
  if (secondPart) {
    keyRisks.push(`Secondary bottleneck on part ${secondPart.itemCode} (${secondPart.description}): ${secondPart.totalQtyVar.toLocaleString()} units short across ${(secondPart.affectedAssemblies || []).slice(0, 3).join(', ')}.`);
  }
  if (missingDatesCount > 0) {
    keyRisks.push(`${missingDatesCount} line items currently have NO SUPPLY RECEIPT DATE on record (PO unconfirmed or parts may be obsolete).`);
  } else {
    keyRisks.push(`Material delivery schedules indicate supplier lead times exceeding requested shop floor production start dates.`);
  }
  keyRisks.push(`Assembly schedules for ${(topPart?.affectedAssemblies || []).concat(secondPart?.affectedAssemblies || []).slice(0, 3).join(', ') || 'key finished goods'} require proactive sequencing or partial builds.`);

  const topExpedites = (topBottlenecks || []).slice(0, 4).map((b: any, idx: number) => {
    const isNoDate = !b.supplyDates || b.supplyDates.includes('Unconfirmed') || b.supplyDates.includes('NO SUPPLY DATE') || b.supplyDates.length === 0;
    return {
      itemCode: b.itemCode,
      itemDescription: b.description,
      actionRequired: isNoDate
        ? `No purchase order confirmed. Contact purchasing immediately to confirm PO placement and transit tracking for ${b.totalQtyVar.toLocaleString()} units before production start ${b.earliestProdStartDate}.`
        : `Negotiate emergency air freight or split-batch shipment of ${b.totalQtyVar.toLocaleString()} units for production start ${b.earliestProdStartDate} (${b.maxDelayDays > 0 ? `+${b.maxDelayDays}d late` : 'Schedule gap'}).`,
      urgency: idx === 0 ? 'CRITICAL / LINE STOPPER' : (isNoDate ? 'CRITICAL / UNCOMMITTED' : 'HIGH')
    };
  });

  const productionRecommendations = [
    `Evaluate partial build options: check for work orders where a substantial percentage of BOM components are committed and in stock to release partial runs today.`,
    `Audit internal buffer stock and secondary warehouse locations for standard hardware and fasteners.`,
    `Coordinate with sales and customer representatives to prioritize critical client shipments and re-align dispatch commitments.`
  ];

  const reallocationOpportunities = [
    `Consolidate on-hand committed stock into single high-priority Work Orders to complete whole finished assemblies rather than spreading inventory thinly across multiple partially-built orders.`
  ];

  return {
    executiveBrief,
    keyRisks,
    topExpedites,
    productionRecommendations,
    reallocationOpportunities
  };
}

export function generateClientCopilotResponse(question: string, datasetContext: any) {
  const q = question.toLowerCase();
  const totalWOs = datasetContext?.totalWOs || 0;
  const criticalCount = datasetContext?.criticalItemsCount || 0;
  const maxDelay = datasetContext?.maxDelayDays || 0;
  const totalVar = datasetContext?.totalQtyVariance || 0;
  const sampleItems: any[] = datasetContext?.sampleItems || [];

  if (q.includes('delay') || q.includes('longest') || q.includes('biggest')) {
    const delayed = [...sampleItems].sort((a, b) => (b.delayDays || 0) - (a.delayDays || 0));
    const top3 = delayed.slice(0, 3);
    return `### 🚨 Top Production Delay Bottlenecks\n\nThe components causing the longest schedule delays are:\n\n` +
      top3.map((i, idx) => `${idx + 1}. **${i.part}** (${i.desc || 'Component'}): **+${i.delayDays || 0} days late** (ETA: ${i.supplyDate || 'Unconfirmed'}, Needed: ${i.prodStart || 'N/A'}). Short by **${i.var?.toLocaleString()} units** for WO **${i.wo}** (${i.assembly}).`).join('\n\n') +
      `\n\n**Recommendation:** Prioritize expediting these parts or simulate partial work order builds.`;
  }

  if (q.includes('no supply') || q.includes('unconfirmed') || q.includes('po') || q.includes('date')) {
    const noDates = sampleItems.filter(i => !i.supplyDate || i.supplyDate === 'Unconfirmed' || i.supplyDate === 'NO SUPPLY DATE');
    if (noDates.length > 0) {
      return `### 📋 Unconfirmed PO / Missing Supply Dates\n\nFound **${noDates.length} component line items** without a confirmed supplier receipt date:\n\n` +
        noDates.slice(0, 4).map(i => `• **${i.part}** (${i.desc}): Needed **${i.needed} units** for WO **${i.wo}** (${i.assembly}). Target Start: **${i.prodStart}**`).join('\n') +
        `\n\n**Action Required:** Raise urgent PO follow-ups with purchasing or check if the part is obsolete.`;
    }
    return `All active material items currently have confirmed supply receipt dates on record.`;
  }

  if (q.includes('pzq') || q.includes('b137') || q.includes('assembly')) {
    return `### 🔍 Assembly Analysis & Hardware Constraints\n\n• **PZQ3089050** assemblies are heavily constrained by fastener **B137** (M6 X 25MM SECURITY SCREW). Arrival ETA is late relative to scheduled assembly starts.\n• **Recommended Strategy:** Consolidate any available on-hand stock into a single batch, or simulate reducing the work order to build partial units immediately.`;
  }

  if (q.includes('ready') || q.includes('start') || q.includes('release')) {
    return `### 🟢 Immediate Production Release Opportunities\n\n• Work Orders with **100% committed stock** or non-material service items can be released to the shop floor immediately.\n• For Work Orders with partial inventory, use the **💡 Simulate & Split WO** button to release buildable finished units today while backordering the remainder.`;
  }

  return `### 📊 Material Shortage Executive Summary\n\n• **Total Work Orders:** ${totalWOs}\n• **Critical Material Shortages:** ${criticalCount} items\n• **Total Quantity Gap:** ${totalVar.toLocaleString()} units\n• **Maximum Schedule Delay:** +${maxDelay} days\n\n**Next Steps:** Review the **Action Plan & Expedite Priorities** table or click **Simulate & Split WO** on individual Work Orders to release immediate production.`;
}
