import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import {
  customers, customerQuarterProfiles, feedbackAssignments, quarters,
  getFeedbackResponses, getFeedbackComment, questions, getScoreLabel, getScoreColor, sectionLabels
} from '@/data/mockData';
import { cn } from '@/lib/utils';

export default function CustomerProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const customer = customers.find(c => c.id === Number(id));
  const [selectedAssignment, setSelectedAssignment] = useState<number | null>(null);

  if (!customer) return <div className="p-8 text-muted-foreground">Customer not found.</div>;

  const profiles = customerQuarterProfiles.filter(p => p.customerId === customer.id);
  const assignments = feedbackAssignments.filter(a => a.customerId === customer.id);
  const currentProfile = profiles.find(p => p.quarterId === 'q1-2026');

  const selectedResponses = selectedAssignment ? getFeedbackResponses(selectedAssignment) : [];
  const selectedComment = selectedAssignment ? getFeedbackComment(selectedAssignment) : null;
  const selectedAsgn = feedbackAssignments.find(a => a.id === selectedAssignment);
  const selectedProfile = selectedAsgn
    ? profiles.find(p => p.quarterId === selectedAsgn.quarterId)
    : null;
  const isNewExpat = selectedProfile?.expatType === 'new';

  const sections = ['service_initiation', 'service_delivery', 'driver_quality', 'overall'] as const;

  return (
    <div className="space-y-6 animate-fade-in-up">
      <Button variant="ghost" onClick={() => navigate('/admin/customers')} className="text-muted-foreground -ml-2">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Customers
      </Button>

      {/* Profile Card */}
      <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">{customer.name}</h1>
            <p className="text-sm text-muted-foreground mt-1">{customer.email} · {customer.phone}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn(
              'text-xs font-medium px-2.5 py-1 rounded-full',
              customer.isActive ? 'bg-emerald-500/15 text-emerald-600' : 'bg-muted text-muted-foreground'
            )}>
              {customer.isActive ? 'Active' : 'Inactive'}
            </span>
            {currentProfile && (
              <span className={cn(
                'text-xs font-medium px-2.5 py-1 rounded-full capitalize',
                currentProfile.expatType === 'new' ? 'bg-accent/15 text-accent' : 'bg-muted text-muted-foreground'
              )}>
                {currentProfile.expatType} Expat
              </span>
            )}
          </div>
        </div>
        {/* Car & Duration Details */}
        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-border">
          <div>
            <p className="text-xs text-muted-foreground">Allocated Car</p>
            <p className="text-sm font-medium text-foreground mt-0.5">{customer.allocatedCar || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Start Date</p>
            <p className="text-sm font-medium text-foreground mt-0.5">{customer.startDate ? new Date(customer.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">End Date</p>
            <p className="text-sm font-medium text-foreground mt-0.5">{customer.endDate ? new Date(customer.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</p>
          </div>
        </div>
      </div>

      {/* Submission History */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">Submission History</h2>
        <div className="bg-card rounded-xl border border-border shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quarter</TableHead>
                <TableHead>Expat Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignments.map(a => {
                const q = quarters.find(q => q.id === a.quarterId);
                const prof = profiles.find(p => p.quarterId === a.quarterId);
                return (
                  <TableRow
                    key={a.id}
                    className={cn('transition-colors', a.status === 'submitted' ? 'cursor-pointer hover:bg-muted/30' : '')}
                    onClick={() => a.status === 'submitted' && setSelectedAssignment(a.id)}
                  >
                    <TableCell className="font-medium">{q?.label ?? a.quarterId}</TableCell>
                    <TableCell className="capitalize">{prof?.expatType ?? '—'}</TableCell>
                    <TableCell>
                      <span className={cn(
                        'text-xs font-medium px-2.5 py-1 rounded-full',
                        a.status === 'submitted' ? 'bg-emerald-500/15 text-emerald-600' : 'bg-accent/15 text-accent'
                      )}>
                        {a.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {a.submittedAt ? new Date(a.submittedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                    </TableCell>
                  </TableRow>
                );
              })}
              {assignments.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No assignments found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Response Detail Slide-over */}
      <Sheet open={selectedAssignment !== null} onOpenChange={() => setSelectedAssignment(null)}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{customer.name}</SheetTitle>
            <SheetDescription>
              {quarters.find(q => q.id === selectedAsgn?.quarterId)?.label} · {selectedProfile?.expatType === 'new' ? 'New' : 'Existing'} Expat
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-6">
            {sections.map(section => {
              if (section === 'service_initiation' && !isNewExpat) return null;
              const sectionQuestions = questions.filter(q => q.section === section);
              return (
                <div key={section}>
                  <h3 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wide">{sectionLabels[section]}</h3>
                  <div className="space-y-3">
                    {sectionQuestions.map(q => {
                      const resp = selectedResponses.find(r => r.questionId === q.id);
                      if (!resp) return null;
                      return (
                        <div key={q.id} className="flex items-start gap-3">
                          <span className="text-xs text-muted-foreground font-mono mt-0.5 w-6 shrink-0">Q{q.number}</span>
                          <div className="flex-1">
                            <p className="text-sm text-foreground leading-snug">{q.text}</p>
                            <div className="flex items-center gap-2 mt-1.5">
                              <span className={cn('w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white', getScoreColor(resp.score))}>
                                {resp.score}
                              </span>
                              <span className="text-xs text-muted-foreground">{getScoreLabel(resp.score)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {selectedComment && (
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2 uppercase tracking-wide">Comments</h3>
                <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3 leading-relaxed">{selectedComment}</p>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}