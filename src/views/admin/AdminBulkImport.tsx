import React, { useState, useRef } from 'react';
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  Download,
  RefreshCw,
  XCircle
} from 'lucide-react';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { BulkLearnerRowInput, BulkImportResult } from '../../models/admin.types';
import { adminApi } from '../../api/adminApi';

interface ParsedRowPreview {
  rowNumber: number;
  data: BulkLearnerRowInput;
  isValid: boolean;
  errors: string[];
  isDuplicateInFile?: boolean;
}

export const AdminBulkImport: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parsedRows, setParsedRows] = useState<ParsedRowPreview[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [importResult, setImportResult] = useState<BulkImportResult | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Download Sample CSV template
  const handleDownloadSample = () => {
    const csvContent =
      'Full Name,Phone Number,Designation,Health Sub Centre,Username,Password\n' +
      'Ananya Deshmukh,9876543210,ASHA_WORKER,Khadakwasla PHC,asha_ananya,Welcome@3210\n' +
      'Kavita Patil,9823456789,ANGANWADI_WORKER,Deolali Center,,\n' +
      'Sunita Rao,9812345678,ANM,Ramtek Health Centre,,';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'aisteth_learners_sample.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Basic CSV parser handling quoted strings and commas
  const parseCSVText = (text: string): string[][] => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    return lines.map((line) => {
      const row: string[] = [];
      let inQuotes = false;
      let currentField = '';

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            currentField += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          row.push(currentField.trim());
          currentField = '';
        } else {
          currentField += char;
        }
      }
      row.push(currentField.trim());
      return row;
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    processFile(selected);
  };

  const processFile = (f: File) => {
    setIsParsing(true);
    setGeneralError(null);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const rows = parseCSVText(content);
        if (rows.length < 2) {
          setGeneralError('The selected CSV file has no data rows.');
          setIsParsing(false);
          return;
        }

        const headers = rows[0].map((h) => h.toLowerCase().replace(/[\s_-]/g, ''));

        // Identify header column indices
        const nameIdx = headers.findIndex((h) => h.includes('name') || h.includes('fullname'));
        const phoneIdx = headers.findIndex((h) => h.includes('phone') || h.includes('mobile') || h.includes('whatsapp'));
        const desigIdx = headers.findIndex((h) => h.includes('designation') || h.includes('role'));
        const distIdx = headers.findIndex((h) => h.includes('district'));
        const stateIdx = headers.findIndex((h) => h.includes('state'));
        const centreIdx = headers.findIndex((h) => h.includes('centre') || h.includes('center') || h.includes('subcentre') || h.includes('facility'));
        const userIdx = headers.findIndex((h) => h.includes('user') || h.includes('username'));
        const pwdIdx = headers.findIndex((h) => h.includes('pass') || h.includes('password'));
        const emailIdx = headers.findIndex((h) => h.includes('email'));

        if (nameIdx === -1 || phoneIdx === -1) {
          setGeneralError(
            'Missing required columns: CSV must contain at least "Full Name" and "Phone Number" headers.'
          );
          setIsParsing(false);
          return;
        }

        const previews: ParsedRowPreview[] = [];
        const seenPhones = new Set<string>();

        for (let i = 1; i < rows.length; i++) {
          const rowData = rows[i];
          // Skip empty row
          if (rowData.length === 1 && rowData[0] === '') continue;

          const displayName = (rowData[nameIdx] || '').trim();
          const phoneNumber = (rowData[phoneIdx] || '').trim();
          const designation = desigIdx !== -1 ? (rowData[desigIdx] || 'ASHA_WORKER').trim() : 'ASHA_WORKER';
          const district = distIdx !== -1 ? (rowData[distIdx] || 'District').trim() : 'District';
          const state = stateIdx !== -1 ? (rowData[stateIdx] || 'State').trim() : 'State';
          const healthSubCentre = centreIdx !== -1 ? (rowData[centreIdx] || '').trim() : '';
          const username = userIdx !== -1 ? (rowData[userIdx] || '').trim() : '';
          const password = pwdIdx !== -1 ? (rowData[pwdIdx] || '').trim() : '';
          const optionalEmail = emailIdx !== -1 ? (rowData[emailIdx] || '').trim() : '';

          const errors: string[] = [];
          if (!displayName) errors.push('Missing Name');

          const cleanPhone = phoneNumber.replace(/[\s\-\(\)\.]/g, '');
          if (!cleanPhone) {
            errors.push('Missing Phone');
          } else if (!/^(?:\+91|91)?[6-9]\d{9}$/.test(cleanPhone)) {
            errors.push('Invalid Phone Format');
          }

          let isDuplicateInFile = false;
          if (cleanPhone) {
            const normalizedClean = cleanPhone.slice(-10);
            if (seenPhones.has(normalizedClean)) {
              isDuplicateInFile = true;
              errors.push('Duplicate in file');
            } else {
              seenPhones.add(normalizedClean);
            }
          }

          previews.push({
            rowNumber: i,
            data: {
              displayName,
              phoneNumber,
              designation,
              healthSubCentre: healthSubCentre || undefined,
              ...(district ? { district } : {}),
              ...(state ? { state } : {}),
              username: username || undefined,
              password: password || undefined,
              optionalEmail: optionalEmail || undefined,
            },
            isValid: errors.length === 0,
            errors,
            isDuplicateInFile,
          });
        }

        setParsedRows(previews);
      } catch (err: any) {
        setGeneralError(`Failed to parse CSV file: ${err?.message || 'Malformed file'}`);
      } finally {
        setIsParsing(false);
      }
    };
    reader.readAsText(f);
  };

  const validRows = parsedRows.filter((r) => r.isValid);
  const invalidRows = parsedRows.filter((r) => !r.isValid);

  const handleExecuteImport = async () => {
    if (validRows.length === 0) return;
    setIsSubmitting(true);
    setGeneralError(null);

    try {
      const payload: BulkLearnerRowInput[] = validRows.map((r) => r.data);
      const res = await adminApi.bulkImportLearners(payload);
      setImportResult(res);
    } catch (err: any) {
      setGeneralError(err?.message || 'Bulk import processing failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setParsedRows([]);
    setImportResult(null);
    setGeneralError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-150">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Upload className="w-5 h-5 text-emerald-600" />
            <span>Bulk CSV Learner Import</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Register multiple trainees simultaneously through a validated CSV file.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleDownloadSample} icon={<Download className="w-3.5 h-3.5" />}>
          Sample CSV Template
        </Button>
      </div>

      {generalError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-xs text-rose-800">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <span>{generalError}</span>
        </div>
      )}

      {/* Upload Dropzone (When no file parsed yet) */}
      {parsedRows.length === 0 && !importResult && (
        <div className="bg-white p-8 rounded-2xl border-2 border-dashed border-slate-200 hover:border-brand-400 text-center transition-all">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            className="hidden"
            id="csv-file-input"
          />
          <div className="w-14 h-14 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mx-auto mb-3">
            <FileText className="w-7 h-7" />
          </div>
          <h3 className="font-bold text-slate-800 text-base">Select or drop a CSV file</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Must contain <strong>Full Name</strong> and <strong>Phone Number</strong> columns. Optional columns include Designation, Health Sub Centre.
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <Button
              variant="primary"
              size="md"
              onClick={() => fileInputRef.current?.click()}
              disabled={isParsing}
              icon={isParsing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            >
              {isParsing ? 'Parsing CSV...' : 'Browse CSV File'}
            </Button>
          </div>
        </div>
      )}

      {/* Preview Section (After file parsed, before submit) */}
      {parsedRows.length > 0 && !importResult && (
        <div className="space-y-5">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 bg-white rounded-xl border border-slate-200 text-center">
              <span className="text-[11px] text-slate-500 font-medium">Total Rows</span>
              <div className="text-xl font-bold text-slate-900 mt-0.5">{parsedRows.length}</div>
            </div>
            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-center">
              <span className="text-[11px] text-emerald-700 font-medium">Valid Ready</span>
              <div className="text-xl font-bold text-emerald-950 mt-0.5">{validRows.length}</div>
            </div>
            <div className="p-4 bg-rose-50 rounded-xl border border-rose-200 text-center">
              <span className="text-[11px] text-rose-700 font-medium">Invalid Errors</span>
              <div className="text-xl font-bold text-rose-950 mt-0.5">{invalidRows.length}</div>
            </div>
            <div className="p-4 bg-white rounded-xl border border-slate-200 flex flex-col justify-center items-center">
              <Button variant="ghost" size="sm" onClick={handleReset} className="text-slate-600 text-xs">
                Upload Different File
              </Button>
            </div>
          </div>

          {/* Preview Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
              <h3 className="font-bold text-xs text-slate-700 uppercase tracking-wider">
                Parsed Rows Preview (First 20 items)
              </h3>
              <span className="text-xs text-slate-500">File: {file?.name}</span>
            </div>
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-100 sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3.5">Row</th>
                    <th className="py-2.5 px-3.5">Full Name</th>
                    <th className="py-2.5 px-3.5">Phone Number</th>
                    <th className="py-2.5 px-3.5">Designation</th>
                    <th className="py-2.5 px-3.5">Health Sub-Centre</th>
                    <th className="py-2.5 px-3.5">Validation Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parsedRows.slice(0, 20).map((r) => (
                    <tr key={r.rowNumber} className={r.isValid ? 'hover:bg-slate-50/50' : 'bg-rose-50/30'}>
                      <td className="py-2 px-3.5 font-mono text-slate-400">#{r.rowNumber}</td>
                      <td className="py-2 px-3.5 font-semibold text-slate-800">{r.data.displayName || '—'}</td>
                      <td className="py-2 px-3.5 font-mono text-slate-600">{r.data.phoneNumber || '—'}</td>
                      <td className="py-2 px-3.5 text-slate-600">{r.data.designation || 'ASHA_WORKER'}</td>
                      <td className="py-2 px-3.5 text-slate-600">
                        {r.data.healthSubCentre || '—'}
                      </td>
                      <td className="py-2 px-3.5">
                        {r.isValid ? (
                          <Badge variant="success" icon={<CheckCircle2 className="w-3 h-3" />}>
                            Valid
                          </Badge>
                        ) : (
                          <Badge variant="error" icon={<XCircle className="w-3 h-3" />}>
                            {r.errors.join(', ')}
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200">
            <span className="text-xs text-slate-600">
              Ready to process <strong>{validRows.length}</strong> valid learner records. Invalid rows will be skipped.
            </span>
            <div className="flex gap-2.5">
              <Button variant="outline" size="sm" onClick={handleReset} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleExecuteImport}
                disabled={isSubmitting || validRows.length === 0}
                icon={isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              >
                {isSubmitting ? 'Registering Learners...' : `Register ${validRows.length} Learners`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Results View (After submission) */}
      {importResult && (
        <div className="space-y-5 animate-in fade-in">
          {/* Result Banner */}
          <div className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Bulk Import Processed</h2>
                  <p className="text-xs text-slate-500">Operation results for {importResult.totalRows} records.</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleReset}>
                Import Another File
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-2">
              <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-100 text-center">
                <span className="text-xs text-emerald-700 font-medium">Successfully Created</span>
                <div className="text-2xl font-black text-emerald-950 mt-0.5">{importResult.successCount}</div>
              </div>
              <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-100 text-center">
                <span className="text-xs text-amber-700 font-medium">Skipped Duplicates</span>
                <div className="text-2xl font-black text-amber-950 mt-0.5">{importResult.skippedCount}</div>
              </div>
              <div className="p-3.5 bg-rose-50 rounded-xl border border-rose-100 text-center">
                <span className="text-xs text-rose-700 font-medium">Failed</span>
                <div className="text-2xl font-black text-rose-950 mt-0.5">{importResult.failedCount}</div>
              </div>
            </div>
          </div>

          {/* Itemized Results Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-xs text-slate-700 uppercase tracking-wider">Itemized Import Report</h3>
            </div>
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-100 sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3.5">Row</th>
                    <th className="py-2.5 px-3.5">Name</th>
                    <th className="py-2.5 px-3.5">Phone</th>
                    <th className="py-2.5 px-3.5">Assigned Username</th>
                    <th className="py-2.5 px-3.5">Result Status</th>
                    <th className="py-2.5 px-3.5">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {importResult.results.map((item) => (
                    <tr key={item.rowNumber} className="hover:bg-slate-50/50">
                      <td className="py-2 px-3.5 font-mono text-slate-400">#{item.rowNumber}</td>
                      <td className="py-2 px-3.5 font-semibold text-slate-800">{item.displayName}</td>
                      <td className="py-2 px-3.5 font-mono text-slate-600">{item.phoneNumber}</td>
                      <td className="py-2 px-3.5 font-mono text-slate-600">@{item.username}</td>
                      <td className="py-2 px-3.5">
                        {item.status === 'SUCCESS' && (
                          <Badge variant="success" icon={<CheckCircle2 className="w-3 h-3" />}>
                            Created
                          </Badge>
                        )}
                        {item.status === 'SKIPPED_DUPLICATE' && (
                          <Badge variant="warning" icon={<AlertCircle className="w-3 h-3" />}>
                            Duplicate
                          </Badge>
                        )}
                        {item.status === 'FAILED' && (
                          <Badge variant="error" icon={<XCircle className="w-3 h-3" />}>
                            Failed
                          </Badge>
                        )}
                      </td>
                      <td className="py-2 px-3.5 text-slate-500">{item.error || 'Account created successfully'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
