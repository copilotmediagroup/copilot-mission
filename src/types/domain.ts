export type UserRole = 'owner' | 'employee';
export type PortfolioStatus = 'draft' | 'ready' | 'active' | 'negotiating' | 'reserved' | 'payment_pending' | 'sold' | 'archived';

export interface Portfolio {
  id: string;
  name: string;
  originalCreditor: string;
  category: string;
  accountCount: number;
  faceValue: number;
  askingPrice: number;
  privateMinimum: number;
  acquisitionCost: number;
  description: string;
  sellingPoints: string[];
  status: PortfolioStatus;
  file?: PortfolioFile;
  createdAt: string;
  activatedAt?: string;
}

export interface PortfolioFile {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
  dataUrl?: string;
}

export interface AuditEvent {
  id: string;
  action: string;
  detail: string;
  occurredAt: string;
}
