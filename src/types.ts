export type RiskLevel = 'CRITICAL' | 'MODERATE' | 'ON_TRACK' | 'EXCLUDED';

export interface WorkOrderItem {
  id: string;
  dateCreated: string;
  woNumber: string;
  assemblyItem: string;
  status: string;
  prodStartDate: string;
  item: string;
  lt: string;
  customer: string;
  itemDescription: string;
  qtyNeeded: number;
  committed: number;
  qtyVar: number;
  units: string;
  assembly: string;
  inventoryType: string;
  allocatedSupply: number | null;
  maxSupplyReceiptDate: string;
  memberQuantity: number | null; // Assembly Item Member Quantity (BOM requirement per finished assembly unit)
  
  // Computed fields
  isNonMaterial: boolean;
  exclusionReason?: string;
  riskLevel: RiskLevel;
  prodStartDateParsed: Date | null;
  supplyDateParsed: Date | null;
  delayDays: number | null; // supplyDate - prodStartDate (positive = late)
  isMissingSupplyDate: boolean;
}

export interface SummaryMetrics {
  totalWOs: number;
  totalLineItems: number;
  activeMaterialItems: number;
  excludedItems: number;
  
  criticalItemsCount: number;
  moderateItemsCount: number;
  onTrackItemsCount: number;
  
  criticalQtyVariance: number;
  moderateQtyVariance: number;
  totalQtyVariance: number;
  
  highRiskWOsCount: number;
  moderateRiskWOsCount: number;
  onTrackWOsCount: number;
  
  maxDelayDays: number;
  avgDelayDays: number;
  missingSupplyDateCount: number;
}

export interface ComponentRollup {
  itemCode: string;
  description: string;
  totalQtyNeeded: number;
  totalCommitted: number;
  totalQtyVar: number;
  affectedWOs: string[];
  affectedAssemblies: string[];
  maxDelayDays: number;
  riskLevel: RiskLevel;
  supplyDates: string[];
  earliestProdStartDate: string;
}

export interface PartialBuildOpportunity {
  isFeasible: boolean;
  originalTargetQty: number;
  maxBuildableQty: number;
  shortageQtyToSplit: number;
  buildablePercentage: number;
  limitingParts: Array<{
    itemCode: string;
    itemDescription: string;
    qtyNeeded: number;
    committed: number;
    shortage: number;
    maxSupplyReceiptDate: string;
  }>;
  fullyAvailablePartsCount: number;
  totalMaterialPartsCount: number;
  suggestionSummary: string;
}

export interface WorkOrderGroup {
  id: string;
  woNumber: string;
  assemblyItem: string;
  customer: string;
  prodStartDate: string;
  dateCreated: string;
  status: string;
  targetOrderQty: number; // Total finished assembly units ordered for this WO (e.g. 30 units, 84 units)
  overallRiskLevel: RiskLevel;
  totalItemsCount: number;
  shortageItemsCount: number;
  totalQtyNeeded: number;
  totalCommitted: number;
  totalQtyVar: number;
  maxDelayDays: number | null;
  hasMissingSupplyDate: boolean;
  shortItems: WorkOrderItem[];
  allMaterialItems: WorkOrderItem[];
  excludedItems: WorkOrderItem[];
  partialBuild?: PartialBuildOpportunity;
}

export interface AssemblyGroup {
  id: string;
  assemblyItem: string;
  workOrders: WorkOrderGroup[];
  overallRiskLevel: RiskLevel;
  totalWOCount: number;
  totalShortageItemsCount: number;
  totalQtyNeeded: number;
  totalCommitted: number;
  totalQtyVar: number;
  earliestProdStartDate: string;
  partialBuildAvailableCount?: number;
  uniqueMissingParts: Array<{
    itemCode: string;
    itemDescription: string;
    totalQtyNeeded: number;
    totalCommitted: number;
    totalQtyVar: number;
    maxSupplyReceiptDate: string;
    delayDays: number | null;
    riskLevel: RiskLevel;
    wosAffected: string[];
  }>;
}

export interface AssemblyRollup {
  assemblyCode: string;
  woNumbers: string[];
  totalShortageItems: number;
  totalQtyVar: number;
  hasCriticalShortage: boolean;
  earliestProdDate: string;
  blockingItems: string[];
}

export interface ExpediteRecommendation {
  id: string;
  itemCode: string;
  description: string;
  totalShortage: number;
  criticality: 'URGENT' | 'HIGH' | 'MEDIUM';
  affectedWOCount: number;
  recommendedArrivalDate: string;
  currentArrivalDate: string;
  impactedAssemblies: string[];
  suggestedAction: string;
}

export interface AIAnalysisResponse {
  executiveBrief: string;
  keyRisks: string[];
  topExpedites: Array<{
    itemCode: string;
    itemDescription: string;
    actionRequired: string;
    urgency: string;
  }>;
  productionRecommendations: string[];
  reallocationOpportunities: string[];
}
