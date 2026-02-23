
export enum PlanType {
  CLASSIC = 'Classic',
  PRO = 'Pro',
  UNLIMITED = 'Elite'
}

export enum DeviceType {
  TOTEM = 'totem',
  PREMIUM = 'premium'
}

export interface Device {
  id: string;
  tenant_id: string;
  uid: string;
  type: DeviceType;
  name: string;
  active: boolean;
  status: 'assigned' | 'linked' | 'disabled';
  linked_customer_id?: string;
  customer?: Contact;
  uid_formatted?: string;
}

export interface DeviceBatch {
  id: string;
  tenant_id: string;
  batch_number?: string;
  type: string;
  quantity: number;
  label?: string;
  total: number;
  assigned: number;
  linked: number;
  disabled: number;
  created_at: string;
}

export interface Tenant {
  id: string;
  name: string;
  owner_name?: string;
  phone?: string;
  email: string;
  slug: string;
  plan: PlanType;
  plan_id?: string;
  custom_contact_limit?: number;
  plan_expires_at?: string;
  customers_count?: number;
  status: 'active' | 'warning' | 'expired' | 'blocked';
  loyalty_active: boolean;
  pin_hash?: string;
  points_goal: number;
  reward_text: string;
  logo_url?: string;
  description?: string;
}

export interface PointMovement {
  id: string;
  contactId: string;
  tenantId: string;
  type: 'earn' | 'redeem';
  points: number;
  origin: 'totem' | 'premium' | 'manual';
  timestamp: string;
  description: string;
}

export interface TagLot {
  id: string;
  tenantId: string;
  name: string;
  quantity: number;
  pointsPerUse: number;
  active: boolean;
  createdAt: string;
}

export interface TenantTag {
  id: string;
  tenant_id: string;
  name: string;
  color: string;
  category: string;
  created_at: string;
}

export interface Contact {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  phone: string;
  province?: string;
  city?: string;
  postalCode?: string;
  address?: string;
  tags: string[];
  notes: string;
  createdAt: string;
  pointsBalance: number;
  isPremium: boolean;
  loyaltyLevel: number;
  loyalty_level_name?: string;
  linkedCard?: string;
  lastContacted?: string;
  reminderDate?: string;
  reminderTime?: string;
  reminderText?: string;
  exported?: boolean;
  source?: string;
  birthday?: string;
  preferences?: string[];
  totalSpent?: number;
  averageTicket?: number;
  attendanceCount?: number;
}
export interface PointRequest {
  id: string;
  tenant_id: string;
  customer_id?: string;
  phone: string;
  device_id?: string;
  source: 'approval' | 'manual_card' | 'online_qr' | 'auto_checkin';
  status: 'pending' | 'approved' | 'denied' | 'auto_approved';
  requested_points: number;
  approved_by?: string;
  created_at: string;
  approved_at?: string;
  meta?: any;
}
