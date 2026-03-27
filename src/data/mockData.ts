export const currentQuarter = { label: 'Q1 2026', year: 2026, quarter_number: 1 };

export const quarters = [
  { id: 'q1-2026', label: 'Q1 2026', year: 2026, quarter_number: 1, is_active: true },
  { id: 'q4-2025', label: 'Q4 2025', year: 2025, quarter_number: 4, is_active: false },
  { id: 'q3-2025', label: 'Q3 2025', year: 2025, quarter_number: 3, is_active: false },
  { id: 'q2-2025', label: 'Q2 2025', year: 2025, quarter_number: 2, is_active: false },
  { id: 'q1-2025', label: 'Q1 2025', year: 2025, quarter_number: 1, is_active: false },
];

export type QuarterReport = {
  quarterId: string;
  totalRespondents: number;
  totalAssigned: number;
  newExpatCount: number;
  siAvg: number; siPct: number;
  sdAvg: number; sdPct: number;
  dqAvg: number; dqPct: number;
  osAvg: number; osPct: number;
  overallPct: number;
  outcome: 'on_target' | 'below_target' | 'penalty' | 'incentive';
};

export const quarterReports: QuarterReport[] = [
  { quarterId: 'q1-2026', totalRespondents: 8, totalAssigned: 9, newExpatCount: 3, siAvg: 3.33, siPct: 83.3, sdAvg: 3.42, sdPct: 85.4, dqAvg: 3.38, dqPct: 84.4, osAvg: 3.38, osPct: 84.4, overallPct: 84.4, outcome: 'incentive' },
  { quarterId: 'q4-2025', totalRespondents: 5, totalAssigned: 7, newExpatCount: 2, siAvg: 3.47, siPct: 86.7, sdAvg: 3.33, sdPct: 83.3, dqAvg: 3.39, dqPct: 84.7, osAvg: 3.40, osPct: 85.0, overallPct: 84.9, outcome: 'on_target' },
  { quarterId: 'q3-2025', totalRespondents: 2, totalAssigned: 2, newExpatCount: 1, siAvg: 3.40, siPct: 85.0, sdAvg: 3.08, sdPct: 77.1, dqAvg: 3.17, dqPct: 79.2, osAvg: 3.50, osPct: 87.5, overallPct: 82.2, outcome: 'below_target' },
  { quarterId: 'q2-2025', totalRespondents: 6, totalAssigned: 8, newExpatCount: 1, siAvg: 3.20, siPct: 80.0, sdAvg: 2.89, sdPct: 72.2, dqAvg: 2.94, dqPct: 73.6, osAvg: 2.83, osPct: 70.8, overallPct: 74.2, outcome: 'penalty' },
  { quarterId: 'q1-2025', totalRespondents: 7, totalAssigned: 9, newExpatCount: 2, siAvg: 3.30, siPct: 82.5, sdAvg: 3.45, sdPct: 86.3, dqAvg: 3.52, dqPct: 88.1, osAvg: 3.43, osPct: 85.7, overallPct: 85.6, outcome: 'on_target' },
];

export function getOutcomeLabel(outcome: string): string {
  switch (outcome) {
    case 'on_target': return 'On Target';
    case 'below_target': return 'Below Target';
    case 'penalty': return 'Penalty −3%';
    case 'incentive': return 'Incentive +3%';
    default: return '';
  }
}

export function getOutcomeBorderColor(outcome: string): string {
  switch (outcome) {
    case 'on_target': return 'border-l-emerald-500';
    case 'below_target': return 'border-l-amber-500';
    case 'penalty': return 'border-l-red-500';
    case 'incentive': return 'border-l-teal-500';
    default: return '';
  }
}

export function getOutcomeBadgeClasses(outcome: string): string {
  switch (outcome) {
    case 'on_target': return 'bg-emerald-500/15 text-emerald-600';
    case 'below_target': return 'bg-amber-500/15 text-amber-600';
    case 'penalty': return 'bg-red-500/15 text-red-600';
    case 'incentive': return 'bg-teal-500/15 text-teal-600';
    default: return 'bg-muted text-muted-foreground';
  }
}

export const dashboardMetrics = {
  totalActiveCustomers: 47,
  currentQuarterResponded: 34,
  currentQuarterTotal: 47,
  overallSatisfaction: 87.3,
  penaltyApplies: false,
  incentiveApplies: true,
};

export const kpiResults = {
  serviceInitiation: { avg: 3.42, pct: 85.5 },
  serviceDelivery: { avg: 3.51, pct: 87.8 },
  driverQuality: { avg: 3.56, pct: 89.0 },
  overallService: { avg: 3.49, pct: 87.3 },
};

export const quarterKpiData: Record<string, {
  metrics: typeof dashboardMetrics;
  kpi: typeof kpiResults;
}> = {
  'q3-2024': {
    metrics: { totalActiveCustomers: 34, currentQuarterResponded: 30, currentQuarterTotal: 34, overallSatisfaction: 76.8, penaltyApplies: true, incentiveApplies: false },
    kpi: { serviceInitiation: { avg: 2.95, pct: 73.8 }, serviceDelivery: { avg: 3.10, pct: 77.5 }, driverQuality: { avg: 3.05, pct: 76.3 }, overallService: { avg: 3.08, pct: 77.0 } },
  },
  'q4-2024': {
    metrics: { totalActiveCustomers: 36, currentQuarterResponded: 33, currentQuarterTotal: 36, overallSatisfaction: 78.5, penaltyApplies: true, incentiveApplies: false },
    kpi: { serviceInitiation: { avg: 3.02, pct: 75.5 }, serviceDelivery: { avg: 3.18, pct: 79.5 }, driverQuality: { avg: 3.14, pct: 78.5 }, overallService: { avg: 3.15, pct: 78.8 } },
  },
  'q1-2025': {
    metrics: { totalActiveCustomers: 38, currentQuarterResponded: 36, currentQuarterTotal: 38, overallSatisfaction: 81.2, penaltyApplies: false, incentiveApplies: false },
    kpi: { serviceInitiation: { avg: 3.15, pct: 78.8 }, serviceDelivery: { avg: 3.30, pct: 82.5 }, driverQuality: { avg: 3.28, pct: 82.0 }, overallService: { avg: 3.25, pct: 81.3 } },
  },
  'q2-2025': {
    metrics: { totalActiveCustomers: 40, currentQuarterResponded: 38, currentQuarterTotal: 40, overallSatisfaction: 79.4, penaltyApplies: true, incentiveApplies: false },
    kpi: { serviceInitiation: { avg: 3.05, pct: 76.3 }, serviceDelivery: { avg: 3.22, pct: 80.5 }, driverQuality: { avg: 3.18, pct: 79.5 }, overallService: { avg: 3.18, pct: 79.5 } },
  },
  'q3-2025': {
    metrics: { totalActiveCustomers: 42, currentQuarterResponded: 40, currentQuarterTotal: 42, overallSatisfaction: 82.7, penaltyApplies: false, incentiveApplies: false },
    kpi: { serviceInitiation: { avg: 3.20, pct: 80.0 }, serviceDelivery: { avg: 3.35, pct: 83.8 }, driverQuality: { avg: 3.38, pct: 84.5 }, overallService: { avg: 3.31, pct: 82.8 } },
  },
  'q4-2025': {
    metrics: { totalActiveCustomers: 44, currentQuarterResponded: 42, currentQuarterTotal: 44, overallSatisfaction: 85.1, penaltyApplies: false, incentiveApplies: true },
    kpi: { serviceInitiation: { avg: 3.35, pct: 83.8 }, serviceDelivery: { avg: 3.44, pct: 86.0 }, driverQuality: { avg: 3.50, pct: 87.5 }, overallService: { avg: 3.41, pct: 85.3 } },
  },
  'q1-2026': {
    metrics: dashboardMetrics,
    kpi: kpiResults,
  },
};

export const recentActivity = [
  { id: 1, customerName: 'Robert Tanaka', quarter: 'Q1 2026', timeAgo: '12 minutes ago', status: 'submitted' as const },
  { id: 2, customerName: 'Maria Gonzalez', quarter: 'Q1 2026', timeAgo: '2 hours ago', status: 'submitted' as const },
  { id: 3, customerName: 'Ahmad Al-Rashid', quarter: 'Q1 2026', timeAgo: '5 hours ago', status: 'submitted' as const },
  { id: 4, customerName: 'Chen Wei Lin', quarter: 'Q1 2026', timeAgo: 'Yesterday', status: 'submitted' as const },
  { id: 5, customerName: 'Fatima Okonkwo', quarter: 'Q1 2026', timeAgo: '2 days ago', status: 'submitted' as const },
];

export const questions = [
  { id: 1, number: 1, text: 'I have been provided with sufficient information on rental process, car options and planned delivery.', section: 'service_initiation', isNewExpatOnly: true },
  { id: 2, number: 2, text: 'Administrative staff is easy to work with and promptly respond to my requests.', section: 'service_initiation', isNewExpatOnly: true },
  { id: 3, number: 3, text: 'I am clearly communicated on items covered under lease car agreement and driver\'s service fees.', section: 'service_initiation', isNewExpatOnly: true },
  { id: 4, number: 4, text: 'My car order is timely delivered to me as planned.', section: 'service_initiation', isNewExpatOnly: true },
  { id: 5, number: 5, text: 'The car meets my expectation and is in perfect condition (cleanliness, safety and functionality) upon delivery.', section: 'service_initiation', isNewExpatOnly: true },
  { id: 6, number: 6, text: 'The car is regularly taken for maintenance service.', section: 'service_delivery', isNewExpatOnly: false },
  { id: 7, number: 7, text: 'Please rate the quality of regular servicing (car check up and maintenance).', section: 'service_delivery', isNewExpatOnly: false },
  { id: 8, number: 8, text: 'Interior and exterior of the car is well maintained in terms of cleanliness and functionality.', section: 'service_delivery', isNewExpatOnly: false },
  { id: 9, number: 9, text: 'I always receive prompt response on emergency or special request from administrative staff.', section: 'service_delivery', isNewExpatOnly: false },
  { id: 10, number: 10, text: 'I am timely informed in advance about car maintenance schedule and provided with interim car, if needed.', section: 'service_delivery', isNewExpatOnly: false },
  { id: 11, number: 11, text: 'Billing and invoicing process is accurate and easy to settle.', section: 'service_delivery', isNewExpatOnly: false },
  { id: 12, number: 12, text: 'Driver always reports to work on time and fulfills his duty during service hours.', section: 'driver_quality', isNewExpatOnly: false },
  { id: 13, number: 13, text: 'Driver communicates English well and actively responds to my request.', section: 'driver_quality', isNewExpatOnly: false },
  { id: 14, number: 14, text: 'Driver is patient, calm and has good driving behaviour.', section: 'driver_quality', isNewExpatOnly: false },
  { id: 15, number: 15, text: 'Driver is well-trained on road safety and follows traffic rules and regulations.', section: 'driver_quality', isNewExpatOnly: false },
  { id: 16, number: 16, text: 'Driver is well-groomed and dressed appropriately.', section: 'driver_quality', isNewExpatOnly: false },
  { id: 17, number: 17, text: 'Driver is flexible to special requests.', section: 'driver_quality', isNewExpatOnly: false },
  { id: 18, number: 18, text: 'Please rate your overall experience with car rental services in the past 6 months.', section: 'overall', isNewExpatOnly: false },
];

export type Customer = {
  id: number;
  name: string;
  email: string;
  phone: string;
  employeeId: string;
  isActive: boolean;
  createdAt: string;
  allocatedCar: string;
  startDate: string;
  endDate: string;
};

export type CustomerQuarterProfile = {
  customerId: number;
  quarterId: string;
  expatType: 'new' | 'existing';
};

export type FeedbackAssignment = {
  id: number;
  quarterId: string;
  customerId: number;
  status: 'pending' | 'submitted';
  submittedAt: string | null;
};

export type FeedbackResponse = {
  assignmentId: number;
  questionId: number;
  score: 1 | 2 | 3 | 4;
};

export type FeedbackComment = {
  assignmentId: number;
  comment: string;
};

export const customers: Customer[] = [
  { id: 1, name: 'Robert Tanaka', email: 'robert.tanaka@exxon.com', phone: '+966 55 123 4567', employeeId: 'EMP-1042', isActive: true, createdAt: '2024-08-15', allocatedCar: 'Toyota Camry', startDate: '2024-08-15', endDate: '2026-08-15' },
  { id: 2, name: 'Maria Gonzalez', email: 'maria.gonzalez@exxon.com', phone: '+966 55 234 5678', employeeId: 'EMP-1105', isActive: true, createdAt: '2024-09-01', allocatedCar: 'Honda Accord', startDate: '2024-09-01', endDate: '2026-09-01' },
  { id: 3, name: 'Ahmad Al-Rashid', email: 'ahmad.alrashid@exxon.com', phone: '+966 55 345 6789', employeeId: 'EMP-0987', isActive: true, createdAt: '2024-03-12', allocatedCar: 'Toyota Land Cruiser', startDate: '2024-03-12', endDate: '2026-03-12' },
  { id: 4, name: 'Chen Wei Lin', email: 'chen.weilin@exxon.com', phone: '+966 55 456 7890', employeeId: 'EMP-1201', isActive: true, createdAt: '2025-01-10', allocatedCar: 'Hyundai Sonata', startDate: '2025-01-10', endDate: '2027-01-10' },
  { id: 5, name: 'Fatima Okonkwo', email: 'fatima.okonkwo@exxon.com', phone: '+966 55 567 8901', employeeId: 'EMP-0854', isActive: true, createdAt: '2023-11-20', allocatedCar: 'Nissan Maxima', startDate: '2023-11-20', endDate: '2025-11-20' },
  { id: 6, name: 'James Henderson', email: 'customer@exxon.com', phone: '+966 55 678 9012', employeeId: 'EMP-1150', isActive: true, createdAt: '2024-10-05', allocatedCar: 'Toyota Camry', startDate: '2024-10-05', endDate: '2026-10-05' },
  { id: 7, name: 'Priya Sharma', email: 'priya.sharma@exxon.com', phone: '+966 55 789 0123', employeeId: 'EMP-0912', isActive: false, createdAt: '2024-01-18', allocatedCar: 'Kia K5', startDate: '2024-01-18', endDate: '2025-07-18' },
  { id: 8, name: 'Lars Eriksson', email: 'lars.eriksson@exxon.com', phone: '+966 55 890 1234', employeeId: 'EMP-1078', isActive: true, createdAt: '2024-07-22', allocatedCar: 'GMC Yukon', startDate: '2024-07-22', endDate: '2026-07-22' },
  { id: 9, name: 'Yuki Watanabe', email: 'yuki.watanabe@exxon.com', phone: '+966 55 901 2345', employeeId: 'EMP-1190', isActive: true, createdAt: '2025-01-05', allocatedCar: 'Honda Accord', startDate: '2025-01-05', endDate: '2027-01-05' },
  { id: 10, name: 'David Mensah', email: 'david.mensah@exxon.com', phone: '+966 55 012 3456', employeeId: 'EMP-0765', isActive: false, createdAt: '2023-06-14', allocatedCar: 'Toyota Corolla', startDate: '2023-06-14', endDate: '2025-06-14' },
  { id: 11, name: 'Sophie Dubois', email: 'sophie.dubois@exxon.com', phone: '+966 55 111 2233', employeeId: 'EMP-1220', isActive: true, createdAt: '2025-02-01', allocatedCar: 'Chevrolet Malibu', startDate: '2025-02-01', endDate: '2027-02-01' },
  { id: 12, name: 'Khalid Al-Dosari', email: 'khalid.dosari@exxon.com', phone: '+966 55 222 3344', employeeId: 'EMP-0630', isActive: false, createdAt: '2023-02-28', allocatedCar: 'Nissan Patrol', startDate: '2023-02-28', endDate: '2025-02-28' },
];

// Demo customer mapping — user id '2' maps to customer id 6
export const DEMO_CUSTOMER_ID = 6;

export const customerQuarterProfiles: CustomerQuarterProfile[] = [
  { customerId: 1, quarterId: 'q1-2026', expatType: 'existing' },
  { customerId: 2, quarterId: 'q1-2026', expatType: 'existing' },
  { customerId: 3, quarterId: 'q1-2026', expatType: 'existing' },
  { customerId: 4, quarterId: 'q1-2026', expatType: 'new' },
  { customerId: 5, quarterId: 'q1-2026', expatType: 'existing' },
  { customerId: 6, quarterId: 'q1-2026', expatType: 'existing' },
  { customerId: 7, quarterId: 'q4-2025', expatType: 'existing' },
  { customerId: 8, quarterId: 'q1-2026', expatType: 'existing' },
  { customerId: 9, quarterId: 'q1-2026', expatType: 'new' },
  { customerId: 10, quarterId: 'q4-2025', expatType: 'new' },
  { customerId: 11, quarterId: 'q1-2026', expatType: 'new' },
  { customerId: 12, quarterId: 'q3-2025', expatType: 'existing' },
  // Historical profiles
  { customerId: 1, quarterId: 'q4-2025', expatType: 'new' },
  { customerId: 2, quarterId: 'q4-2025', expatType: 'existing' },
  { customerId: 3, quarterId: 'q4-2025', expatType: 'existing' },
  { customerId: 5, quarterId: 'q4-2025', expatType: 'existing' },
  { customerId: 6, quarterId: 'q3-2025', expatType: 'new' },
  { customerId: 6, quarterId: 'q4-2025', expatType: 'existing' },
  { customerId: 6, quarterId: 'q2-2025', expatType: 'existing' },
  { customerId: 8, quarterId: 'q4-2025', expatType: 'new' },
];

export const feedbackAssignments: FeedbackAssignment[] = [
  { id: 1, quarterId: 'q1-2026', customerId: 1, status: 'submitted', submittedAt: '2026-03-20T14:32:00Z' },
  { id: 2, quarterId: 'q1-2026', customerId: 2, status: 'submitted', submittedAt: '2026-03-20T12:15:00Z' },
  { id: 3, quarterId: 'q1-2026', customerId: 3, status: 'submitted', submittedAt: '2026-03-20T09:45:00Z' },
  { id: 4, quarterId: 'q1-2026', customerId: 4, status: 'submitted', submittedAt: '2026-03-19T16:20:00Z' },
  { id: 5, quarterId: 'q1-2026', customerId: 5, status: 'submitted', submittedAt: '2026-03-18T11:30:00Z' },
  { id: 6, quarterId: 'q1-2026', customerId: 6, status: 'pending', submittedAt: null },
  { id: 7, quarterId: 'q1-2026', customerId: 8, status: 'submitted', submittedAt: '2026-03-16T15:10:00Z' },
  { id: 8, quarterId: 'q1-2026', customerId: 9, status: 'submitted', submittedAt: '2026-03-15T10:00:00Z' },
  { id: 9, quarterId: 'q1-2026', customerId: 11, status: 'pending', submittedAt: null },
  { id: 10, quarterId: 'q4-2025', customerId: 1, status: 'submitted', submittedAt: '2025-12-18T13:20:00Z' },
  { id: 11, quarterId: 'q4-2025', customerId: 2, status: 'submitted', submittedAt: '2025-12-17T09:10:00Z' },
  { id: 12, quarterId: 'q4-2025', customerId: 3, status: 'submitted', submittedAt: '2025-12-15T14:45:00Z' },
  { id: 13, quarterId: 'q4-2025', customerId: 5, status: 'submitted', submittedAt: '2025-12-14T11:00:00Z' },
  { id: 14, quarterId: 'q4-2025', customerId: 7, status: 'submitted', submittedAt: '2025-12-12T16:30:00Z' },
  { id: 15, quarterId: 'q4-2025', customerId: 8, status: 'submitted', submittedAt: '2025-12-10T08:20:00Z' },
  { id: 16, quarterId: 'q4-2025', customerId: 10, status: 'pending', submittedAt: null },
  { id: 17, quarterId: 'q3-2025', customerId: 6, status: 'submitted', submittedAt: '2025-09-20T10:15:00Z' },
  { id: 18, quarterId: 'q3-2025', customerId: 12, status: 'submitted', submittedAt: '2025-09-18T14:00:00Z' },
  // Extra history for demo customer (id 6)
  { id: 19, quarterId: 'q4-2025', customerId: 6, status: 'submitted', submittedAt: '2025-12-19T09:30:00Z' },
  { id: 20, quarterId: 'q2-2025', customerId: 6, status: 'submitted', submittedAt: '2025-06-15T11:45:00Z' },
];

// Scores per assignment - only for submitted ones
const s = (scores: number[]) => scores as (1 | 2 | 3 | 4)[];

const assignmentScores: Record<number, (1 | 2 | 3 | 4)[]> = {
  // assignment 1 - Robert Q1 2026 (existing, no SI)
  1: s([3, 4, 3, 4, 3, 4, 4, 3, 3, 4, 3, 4, 3]),
  // assignment 2 - Maria Q1 2026 (existing)
  2: s([4, 3, 4, 3, 4, 3, 3, 4, 4, 3, 4, 3, 4]),
  // assignment 3 - Ahmad Q1 2026 (existing)
  3: s([3, 3, 2, 3, 3, 4, 3, 3, 4, 3, 2, 3, 3]),
  // assignment 4 - Chen Q1 2026 (new, has SI)
  4: s([4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 4, 3, 4]),
  // assignment 5 - Fatima Q1 2026 (existing)
  5: s([4, 4, 3, 4, 4, 3, 4, 4, 3, 4, 4, 3, 4]),
  // assignment 6 - James Q1 2026 — NOW PENDING, no scores
  // assignment 7 - Lars Q1 2026 (existing)
  7: s([3, 4, 3, 3, 4, 3, 3, 4, 4, 3, 3, 4, 3]),
  // assignment 8 - Yuki Q1 2026 (new, has SI)
  8: s([3, 4, 3, 2, 3, 4, 3, 4, 3, 2, 3, 4, 3, 4, 3, 3, 4, 3]),
  // assignment 10 - Robert Q4 2025 (new, has SI)
  10: s([4, 3, 3, 4, 3, 4, 3, 3, 4, 3, 4, 3, 4, 3, 3, 4, 3, 4]),
  // assignment 11 - Maria Q4 2025 (existing)
  11: s([3, 4, 3, 4, 3, 3, 4, 3, 4, 3, 4, 3, 3]),
  // assignment 12 - Ahmad Q4 2025 (existing)
  12: s([4, 3, 3, 2, 3, 4, 3, 3, 4, 3, 4, 3, 3]),
  // assignment 13 - Fatima Q4 2025 (existing)
  13: s([4, 4, 3, 4, 3, 4, 4, 3, 3, 4, 4, 3, 4]),
  // assignment 14 - Priya Q4 2025 (existing)
  14: s([3, 2, 3, 3, 2, 3, 3, 2, 3, 3, 2, 3, 3]),
  // assignment 15 - Lars Q4 2025 (new, has SI)
  15: s([3, 4, 3, 4, 3, 3, 4, 3, 4, 3, 3, 4, 3, 4, 3, 3, 4, 3]),
  // assignment 17 - James Q3 2025 (new, has SI)
  17: s([4, 3, 4, 3, 3, 4, 3, 4, 3, 3, 4, 3, 4, 3, 4, 3, 3, 4]),
  // assignment 18 - Khalid Q3 2025 (existing)
  18: s([3, 3, 2, 3, 3, 2, 3, 3, 2, 3, 3, 2, 3]),
  // assignment 19 - James Q4 2025 (existing, no SI)
  19: s([3, 4, 3, 3, 4, 3, 3, 4, 3, 4, 3, 3, 3]),
  // assignment 20 - James Q2 2025 (existing, no SI)
  20: s([3, 3, 4, 3, 3, 4, 3, 3, 4, 3, 3, 4, 3]),
};

export function getFeedbackResponses(assignmentId: number): FeedbackResponse[] {
  const scores = assignmentScores[assignmentId];
  if (!scores) return [];
  const assignment = feedbackAssignments.find(a => a.id === assignmentId);
  if (!assignment) return [];
  const profile = customerQuarterProfiles.find(
    p => p.customerId === assignment.customerId && p.quarterId === assignment.quarterId
  );
  const isNew = profile?.expatType === 'new';
  const applicableQuestions = questions.filter(q => isNew || !q.isNewExpatOnly);
  return applicableQuestions.map((q, i) => ({
    assignmentId,
    questionId: q.id,
    score: scores[i] ?? 3,
  }));
}

const assignmentComments: Record<number, string> = {
  1: 'Overall good service. The driver could improve on punctuality during early morning requests.',
  2: 'Very satisfied with the car condition and driver professionalism. Keep it up!',
  3: 'Billing issues need to be addressed. Had to follow up twice on incorrect invoices.',
  4: 'As a new expat, the onboarding was smooth. Car was delivered on time and in great condition.',
  5: 'Excellent service across the board. No complaints at all.',
  // 6 is pending, no comment
  7: 'Driver is excellent. Car maintenance could be more frequent.',
  8: 'Good initial experience. The car delivery was slightly delayed but the team communicated well.',
  10: 'Great first quarter experience. The administrative team was very helpful during my transition.',
  14: 'Service has declined compared to previous quarters. Driver replacement was not handled well.',
  17: 'Fantastic onboarding process. Everything was well organized.',
  18: 'Average service. Nothing exceptional but nothing terrible either.',
  19: 'Good service this quarter. Billing was smooth and driver was reliable.',
  20: 'Solid experience overall. The car was always clean and well maintained.',
};

export function getFeedbackComment(assignmentId: number): string | null {
  return assignmentComments[assignmentId] ?? null;
}

export function getScoreLabel(score: number): string {
  switch (score) {
    case 4: return 'Excellent';
    case 3: return 'Good';
    case 2: return 'Fair';
    case 1: return 'Needs Improvement';
    default: return '';
  }
}

export function getScoreColor(score: number): string {
  switch (score) {
    case 4: return 'bg-emerald-500';
    case 3: return 'bg-amber-400';
    case 2: return 'bg-orange-500';
    case 1: return 'bg-red-500';
    default: return 'bg-muted';
  }
}

export const sectionLabels: Record<string, string> = {
  service_initiation: 'Service Initiation',
  service_delivery: 'Service Delivery',
  driver_quality: 'Driver Quality',
  overall: 'Overall Service',
};
