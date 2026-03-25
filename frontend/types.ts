
export enum PlanType {
  PRO = 'Pro',
  UNLIMITED = 'Elite'
}

export enum DeviceType {
  TOTEM = 'totem'
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
  telegram_chat_id?: string;
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
  total_contact_limit?: number;
  extra_contacts_quota?: number;
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
  origin: 'totem' | 'manual';
  timestamp: string;
  description: string;
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
  loyaltyLevel: number;
  loyalty_level_name?: string;
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
  visitas?: number;
  photo_url?: string;
  photo_url_full?: string;
  company_name?: string;
  created_at?: string;
}
export interface Reminder {
  id: string;
  tenant_id: string;
  customer_id: string;
  reminder_date: string;
  reminder_time: string;
  reminder_text: string;
  status: 'pending' | 'sent' | 'cancelled';
}

export interface PointRequest {
  id: string;
  tenant_id: string;
  customer_id?: string;
  phone: string;
  device_id?: string;
  source: 'approval' | 'online_qr' | 'auto_checkin';
  status: 'pending' | 'approved' | 'denied' | 'auto_approved';
  requested_points: number;
  approved_by?: string;
  created_at: string;
  approved_at?: string;
  meta?: any;
}
export interface Visit {
  id: string;
  tenant_id: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  customer_company?: string;
  customer_photo_url?: string;
  visit_at: string;
  origin: string;
  plan_type: string;
  status: 'pendente' | 'aprovado' | 'negado';
  points_granted: number;
  device_id?: string;
  device?: {
    id: string;
    name: string;
  };
  approved_by?: string;
  approved_at?: string;
  created_at: string;
  meta?: {
    reason?: string;
    [key: string]: any;
  };
  customer?: Contact;
}
