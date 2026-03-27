import { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Download, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Customer } from '@/data/mockData';
import { cn } from '@/lib/utils';

type ParsedRow = {
  name: string;
  email: string;
  phone: string;
  expatType: 'new' | 'existing';
  isActive: boolean;
  error?: string;
};

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (customers: Omit<Customer, 'id' | 'employeeId' | 'createdAt'>[]) => void;
  existingEmails: string[];
}

function parseCSV(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  return lines.map(line => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') { inQuotes = !inQuotes; }
      else if (char === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
      else { current += char; }
    }
    result.push(current.trim());
    return result;
  });
}

function validateRow(row: string[], headers: string[], existingEmails: string[]): ParsedRow {
  const get = (key: string) => {
    const idx = headers.findIndex(h => h.toLowerCase().replace(/[^a-z]/g, '') === key);
    return idx >= 0 ? row[idx]?.trim() ?? '' : '';
  };

  const name = get('name') || get('fullname');
  const email = get('email');
  const phone = get('phone') || get('phonenumber');
  const expatRaw = (get('expattype') || get('type') || 'existing').toLowerCase();
  const activeRaw = (get('active') || get('isactive') || get('status') || 'true').toLowerCase();

  const errors: string[] = [];
  if (!name) errors.push('Name required');
  if (!email) errors.push('Email required');
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Invalid email');
  else if (existingEmails.includes(email.toLowerCase())) errors.push('Duplicate email');

  const expatType: 'new' | 'existing' = expatRaw === 'new' ? 'new' : 'existing';
  const isActive = !['false', '0', 'no', 'inactive'].includes(activeRaw);

  return {
    name, email, phone, expatType, isActive,
    error: errors.length ? errors.join(', ') : undefined,
  };
}

export default function BulkImportDialog({ open, onOpenChange, onImport, existingEmails }: BulkImportDialogProps) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const validRows = parsed.filter(r => !r.error);
  const errorRows = parsed.filter(r => r.error);

  const reset = () => { setParsed([]); setFileName(''); };

  const processFile = (file: File) => {
    if (!file.name.match(/\.(csv|xlsx?)$/i)) {
      toast({ title: 'Invalid file', description: 'Please upload a CSV or Excel file.', variant: 'destructive' });
      return;
    }
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const rows = parseCSV(text);
      if (rows.length < 2) {
        toast({ title: 'Empty file', description: 'The file has no data rows.', variant: 'destructive' });
        return;
      }
      const headers = rows[0].map(h => h.toLowerCase().replace(/[^a-z]/g, ''));
      const dataRows = rows.slice(1).filter(r => r.some(cell => cell.trim()));
      const allEmails = [...existingEmails];
      const results = dataRows.map(row => {
        const parsed = validateRow(row, headers, allEmails);
        if (!parsed.error) allEmails.push(parsed.email.toLowerCase());
        return parsed;
      });
      setParsed(results);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleImport = () => {
    onImport(validRows.map(r => ({
      name: r.name, email: r.email, phone: r.phone, isActive: r.isActive,
      allocatedCar: '', startDate: '', endDate: '',
    })));
    toast({ title: 'Import complete', description: `${validRows.length} customer${validRows.length !== 1 ? 's' : ''} added successfully.` });
    reset();
    onOpenChange(false);
  };

  const downloadTemplate = () => {
    const csv = 'Name,Email,Phone,Expat Type,Active\nJohn Smith,john@company.com,+966 55 000 0000,new,true\nJane Doe,jane@company.com,+966 55 111 1111,existing,true';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'customer_import_template.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Bulk Import Customers</DialogTitle>
          <DialogDescription>Upload a CSV file to add multiple customers at once.</DialogDescription>
        </DialogHeader>

        {parsed.length === 0 ? (
          <div className="space-y-4 py-2">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className={cn(
                'border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all',
                dragOver ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-border hover:border-primary/50 hover:bg-muted/30'
              )}
            >
              <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">Drop your file here or click to browse</p>
              <p className="text-xs text-muted-foreground mt-1">Supports CSV files</p>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={e => { if (e.target.files?.[0]) processFile(e.target.files[0]); }} />
            </div>
            <button onClick={downloadTemplate} className="flex items-center gap-1.5 text-xs text-primary hover:underline mx-auto">
              <Download className="w-3.5 h-3.5" /> Download template
            </button>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col gap-3">
            {/* File info */}
            <div className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-foreground">{fileName}</span>
              </div>
              <button onClick={reset} className="text-muted-foreground hover:text-destructive transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Summary */}
            <div className="flex gap-3">
              <div className="flex items-center gap-1.5 text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span className="text-foreground font-medium">{validRows.length}</span>
                <span className="text-muted-foreground">ready</span>
              </div>
              {errorRows.length > 0 && (
                <div className="flex items-center gap-1.5 text-sm">
                  <AlertCircle className="w-4 h-4 text-destructive" />
                  <span className="text-destructive font-medium">{errorRows.length}</span>
                  <span className="text-muted-foreground">with errors</span>
                </div>
              )}
            </div>

            {/* Preview table */}
            <div className="flex-1 overflow-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsed.map((row, i) => (
                    <TableRow key={i} className={cn(row.error && 'bg-destructive/5')}>
                      <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="text-sm">{row.name || '—'}</TableCell>
                      <TableCell className="text-sm">{row.email || '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{row.phone || '—'}</TableCell>
                      <TableCell>
                        <span className="text-xs capitalize">{row.expatType}</span>
                      </TableCell>
                      <TableCell>
                        {row.error ? (
                          <span className="text-xs text-destructive">{row.error}</span>
                        ) : (
                          <span className="text-xs text-emerald-600">Ready</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {parsed.length > 0 && (
          <DialogFooter>
            <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>Cancel</Button>
            <Button onClick={handleImport} disabled={validRows.length === 0} className="bg-accent hover:bg-accent/90 text-accent-foreground">
              Import {validRows.length} Customer{validRows.length !== 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
