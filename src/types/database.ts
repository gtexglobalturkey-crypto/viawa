export interface Company {
  id: string;

  company_name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;

  country: string | null;
  industry: string | null;

  status: string;

  created_at: string;
  updated_at: string;
}

export interface Exhibition {
  id: string;

  name: string;
  city: string | null;
  country: string | null;

  sector: string | null;
  organizer: string | null;

  start_date: string | null;
  end_date: string | null;

  created_at: string;
  updated_at: string;
}

export interface Opportunity {
  id: string;

  company_id: string;
  exhibition_id: string | null;

  stage: string;

  interest_level: number;

  estimated_value: number;

  next_action: string | null;
  next_action_date: string | null;

  owner: string | null;

  created_at: string;
  updated_at: string;
}

export interface TimelineEvent {
  id: string;

  company_id: string;

  opportunity_id: string | null;

  type: string | null;

  title: string;

  description: string | null;

  created_at: string;
}

export interface Reminder {
  id: string;

  company_id: string;

  title: string;

  due_date: string | null;

  completed: boolean;

  created_at: string;
  updated_at: string;
}

export interface EmailRecord {
  id: string;

  company_id: string;

  subject: string | null;

  body: string | null;

  status: string;

  sent_at: string | null;

  created_at: string;
  updated_at: string;
}

export interface AiMemory {
  id: string;

  company_id: string;

  summary: string | null;

  risk: string | null;

  recommendation: string | null;

  confidence: number;

  created_at: string;
  updated_at: string;
}

export interface CallNote {
  id: string;

  company_id: string;

  opportunity_id: string;

  note: string;

  created_by: string | null;

  created_at: string;
  updated_at: string;
}