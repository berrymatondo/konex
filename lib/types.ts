export type CounterpartyStatus = 
  | "draft"
  | "pending_review"
  | "pending_screening"
  | "pending_risk_review"
  | "active"
  | "blocked";

export type RiskLevel = "low" | "medium" | "high";

export type SourceType = "ASM" | "LSM" | "Recycled";

export type SanctionsStatus = "clear" | "hit" | "pending";

export interface UBO {
  id?: string;
  fullName: string;
  nationality: string | null;
  ownershipPercent: number | null;
  isPEP: boolean;
  pepDetails?: string | null;
}

export interface Document {
  id: string;
  type: string;
  fileName: string;
  fileUrl?: string | null;
  status: string;
  uploadedAt?: string;
}

export interface ScreeningResultItem {
  id?: string;
  checkType: string;
  result: string;
  details?: Record<string, unknown> | null;
  checkedAt?: string;
}

export interface Counterparty {
  id: string;
  legalName: string;
  tradingName?: string | null;
  registrationNumber?: string | null;
  taxId?: string | null;
  legalForm?: string | null;
  countryOfIncorporation: string;
  registeredAddress?: string | null;
  primaryContact?: string | null;
  primaryEmail?: string | null;
  primaryPhone?: string | null;
  goldSourceTypes: string[];
  status: CounterpartyStatus;
  preliminaryScore?: number | null;
  screeningDate?: string | null;
  createdAt: string;
  updatedAt: string;
  ubos?: UBO[];
  documents?: Document[];
  screeningResults?: ScreeningResultItem[];
}

export interface Transaction {
  id: string;
  counterpartyId: string;
  counterpartyName: string;
  type: string;
  referenceNumber: string;
  goldWeight: number;
  goldPurity: number;
  totalValue: number;
  status: string;
  createdAt: string;
}

export interface DashboardStats {
  activeCounterparties: number;
  pendingPOs: number;
  goldInTransit: number;
  monthlyAcquisitions: number;
}
