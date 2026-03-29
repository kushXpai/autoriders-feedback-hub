// src/types/database.types.ts
// Auto-derived from Supabase schema — ExxonMobil Car Rental Feedback Management System

// ============================================================
// ENUMS
// ============================================================

export type AppRole = 'admin' | 'customer';

export type ExpatType = 'new' | 'existing';

export type FeedbackStatus = 'pending' | 'submitted';

export type QuarterOutcome = 'on_target' | 'below_target' | 'penalty' | 'incentive';

export type QuestionSection =
  | 'service_initiation'
  | 'service_delivery'
  | 'driver_quality'
  | 'overall';

// ============================================================
// TABLE ROW TYPES
// ============================================================

/** public.profiles — linked 1-to-1 with auth.users */
export interface Profile {
  id: string; // uuid — references auth.users(id)
  name: string;
  email: string;
  created_at: string; // timestamptz
  updated_at: string; // timestamptz
}

/** public.user_roles */
export interface UserRole {
  id: string; // uuid
  user_id: string; // uuid — references auth.users(id)
  role: AppRole;
}

/** public.quarters */
export interface Quarter {
  id: string; // varchar(20) e.g. "q1-2026"
  label: string; // e.g. "Q1 2026"
  year: number;
  quarter_number: 1 | 2 | 3 | 4;
  is_active: boolean;
  created_at: string; // timestamptz
}

/** public.customers */
export interface Customer {
  id: number; // serial
  name: string;
  email: string;
  phone: string | null;
  employee_id: string;
  is_active: boolean;
  created_at: string; // date (CURRENT_DATE default)
  allocated_car: string | null;
  start_date: string | null; // date
  end_date: string | null; // date
  user_id: string | null; // uuid — references auth.users(id)
  expat_type: ExpatType; // new vs. existing expat classification
}

/** public.customer_quarter_profiles */
export interface CustomerQuarterProfile {
  id: number; // serial
  customer_id: number; // references customers(id)
  quarter_id: string; // references quarters(id)
}

/** public.questions */
export interface Question {
  id: number; // serial
  question_number: number; // unique
  text: string;
  section: QuestionSection;
  is_new_expat_only: boolean;
  is_active: boolean;
  created_at: string; // timestamptz
}

/** public.feedback_assignments */
export interface FeedbackAssignment {
  id: number; // serial
  quarter_id: string; // references quarters(id)
  customer_id: number; // references customers(id)
  status: FeedbackStatus;
  submitted_at: string | null; // timestamptz
  created_at: string; // timestamptz
}

/** public.feedback_responses */
export interface FeedbackResponse {
  id: number; // serial
  assignment_id: number; // references feedback_assignments(id)
  question_id: number; // references questions(id)
  score: 1 | 2 | 3 | 4;
}

/** public.feedback_comments */
export interface FeedbackComment {
  id: number; // serial
  assignment_id: number; // unique — references feedback_assignments(id)
  comment: string;
  created_at: string; // timestamptz
}

/** public.quarter_reports */
export interface QuarterReport {
  id: number; // serial
  quarter_id: string; // unique — references quarters(id)
  total_respondents: number;
  total_assigned: number;
  new_expat_count: number;
  si_avg: number; // numeric(4,2) — service initiation average score
  si_pct: number; // numeric(5,2) — service initiation satisfaction %
  sd_avg: number; // numeric(4,2) — service delivery average score
  sd_pct: number; // numeric(5,2) — service delivery satisfaction %
  dq_avg: number; // numeric(4,2) — driver quality average score
  dq_pct: number; // numeric(5,2) — driver quality satisfaction %
  os_avg: number; // numeric(4,2) — overall service average score
  os_pct: number; // numeric(5,2) — overall service satisfaction %
  overall_pct: number; // numeric(5,2) — overall satisfaction %
  outcome: QuarterOutcome;
  created_at: string; // timestamptz
  updated_at: string; // timestamptz
}

/** public.dashboard_metrics */
export interface DashboardMetric {
  id: number; // serial
  quarter_id: string; // unique — references quarters(id)
  total_active_customers: number;
  current_quarter_responded: number;
  current_quarter_total: number;
  overall_satisfaction: number; // numeric(5,2)
  penalty_applies: boolean;
  incentive_applies: boolean;
  si_avg: number; // numeric(4,2)
  si_pct: number; // numeric(5,2)
  sd_avg: number; // numeric(4,2)
  sd_pct: number; // numeric(5,2)
  dq_avg: number; // numeric(4,2)
  dq_pct: number; // numeric(5,2)
  os_avg: number; // numeric(4,2)
  os_pct: number; // numeric(5,2)
  created_at: string; // timestamptz
}

// ============================================================
// INSERT / UPDATE PAYLOAD TYPES
// ============================================================

export type ProfileInsert = Omit<Profile, 'created_at' | 'updated_at'> &
  Partial<Pick<Profile, 'created_at' | 'updated_at'>>;
export type ProfileUpdate = Partial<Omit<Profile, 'id'>>;

export type UserRoleInsert = Omit<UserRole, 'id'> & Partial<Pick<UserRole, 'id'>>;

export type QuarterInsert = Omit<Quarter, 'created_at'> & Partial<Pick<Quarter, 'created_at'>>;
export type QuarterUpdate = Partial<Omit<Quarter, 'id'>>;

export type CustomerInsert = Omit<Customer, 'id' | 'created_at'> &
  Partial<Pick<Customer, 'id' | 'created_at'>>;
export type CustomerUpdate = Partial<Omit<Customer, 'id'>>;

export type CustomerQuarterProfileInsert = Omit<CustomerQuarterProfile, 'id'> &
  Partial<Pick<CustomerQuarterProfile, 'id'>>;
export type CustomerQuarterProfileUpdate = Partial<Omit<CustomerQuarterProfile, 'id'>>;

export type QuestionInsert = Omit<Question, 'id' | 'created_at'> &
  Partial<Pick<Question, 'id' | 'created_at'>>;
export type QuestionUpdate = Partial<Omit<Question, 'id'>>;

export type FeedbackAssignmentInsert = Omit<FeedbackAssignment, 'id' | 'created_at'> &
  Partial<Pick<FeedbackAssignment, 'id' | 'created_at'>>;
export type FeedbackAssignmentUpdate = Partial<Omit<FeedbackAssignment, 'id'>>;

export type FeedbackResponseInsert = Omit<FeedbackResponse, 'id'> &
  Partial<Pick<FeedbackResponse, 'id'>>;

export type FeedbackCommentInsert = Omit<FeedbackComment, 'id' | 'created_at'> &
  Partial<Pick<FeedbackComment, 'id' | 'created_at'>>;

export type QuarterReportInsert = Omit<QuarterReport, 'id' | 'created_at' | 'updated_at'> &
  Partial<Pick<QuarterReport, 'id' | 'created_at' | 'updated_at'>>;
export type QuarterReportUpdate = Partial<Omit<QuarterReport, 'id'>>;

export type DashboardMetricInsert = Omit<DashboardMetric, 'id' | 'created_at'> &
  Partial<Pick<DashboardMetric, 'id' | 'created_at'>>;
export type DashboardMetricUpdate = Partial<Omit<DashboardMetric, 'id'>>;

// ============================================================
// SUPABASE DATABASE SHAPE (for typed supabase client)
// ============================================================

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: ProfileInsert;
        Update: ProfileUpdate;
      };
      user_roles: {
        Row: UserRole;
        Insert: UserRoleInsert;
        Update: Partial<Omit<UserRole, 'id'>>;
      };
      quarters: {
        Row: Quarter;
        Insert: QuarterInsert;
        Update: QuarterUpdate;
      };
      customers: {
        Row: Customer;
        Insert: CustomerInsert;
        Update: CustomerUpdate;
      };
      customer_quarter_profiles: {
        Row: CustomerQuarterProfile;
        Insert: CustomerQuarterProfileInsert;
        Update: CustomerQuarterProfileUpdate;
      };
      questions: {
        Row: Question;
        Insert: QuestionInsert;
        Update: QuestionUpdate;
      };
      feedback_assignments: {
        Row: FeedbackAssignment;
        Insert: FeedbackAssignmentInsert;
        Update: FeedbackAssignmentUpdate;
      };
      feedback_responses: {
        Row: FeedbackResponse;
        Insert: FeedbackResponseInsert;
        Update: Partial<Omit<FeedbackResponse, 'id'>>;
      };
      feedback_comments: {
        Row: FeedbackComment;
        Insert: FeedbackCommentInsert;
        Update: Partial<Omit<FeedbackComment, 'id'>>;
      };
      quarter_reports: {
        Row: QuarterReport;
        Insert: QuarterReportInsert;
        Update: QuarterReportUpdate;
      };
      dashboard_metrics: {
        Row: DashboardMetric;
        Insert: DashboardMetricInsert;
        Update: DashboardMetricUpdate;
      };
    };
    Enums: {
      app_role: AppRole;
      expat_type: ExpatType;
      feedback_status: FeedbackStatus;
      quarter_outcome: QuarterOutcome;
      question_section: QuestionSection;
    };
  };
}