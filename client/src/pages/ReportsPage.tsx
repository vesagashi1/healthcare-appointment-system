import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { requestWithRetry } from '../services/request';
import { useToast } from '../contexts/ToastContext';

type ReportPayload = {
  generated_at: string;
  filters: Record<string, string | null>;
  overview: {
    total: number;
    approved: number;
    scheduled: number;
    cancelled: number;
    completed: number;
  };
  appointment_status: Array<{ status: string; count: number }>;
  wards: Array<{ ward_id: number; ward_name: string; patient_count: number; appointment_count: number }>;
  record_types: Array<{ record_type: string; count: number }>;
  user_roles: Array<{ role: string; count: number }>;
};

const ReportsSkeleton = () => (
  <div className="space-y-4">
    <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
      {Array.from({ length: 5 }).map((_, idx) => (
        <div key={idx} className="card animate-pulse">
          <div className="h-3 w-20 rounded bg-slate-700/70"></div>
          <div className="mt-3 h-8 w-12 rounded bg-slate-800/70"></div>
        </div>
      ))}
    </div>
    <div className="card animate-pulse">
      <div className="h-4 w-1/4 rounded bg-slate-700/70"></div>
      <div className="mt-4 h-32 rounded bg-slate-800/70"></div>
    </div>
  </div>
);

const ReportsPage = () => {
  const toast = useToast();
  const [report, setReport] = useState<ReportPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [wards, setWards] = useState<any[]>([]);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [wardId, setWardId] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');

  const params = useMemo(() => {
    const next: Record<string, string> = {};
    if (startDate) next.start_date = startDate;
    if (endDate) next.end_date = endDate;
    if (wardId) next.ward_id = wardId;
    if (role) next.role = role;
    if (status) next.status = status;
    return next;
  }, [startDate, endDate, wardId, role, status]);

  const loadReport = async () => {
    setLoading(true);
    try {
      const response = await requestWithRetry(() =>
        api.get('/reports/summary', {
          params,
        })
      );
      setReport(response.data.report);
    } catch (error: any) {
      setReport(null);
      toast.error(error.response?.data?.message || 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  useEffect(() => {
    const loadWards = async () => {
      try {
        const response = await requestWithRetry(() => api.get('/wards'));
        setWards(response.data.wards || []);
      } catch {
        setWards([]);
      }
    };
    loadWards();
  }, []);

  const exportReport = async (format: 'json' | 'csv' | 'xlsx') => {
    setDownloading(true);
    try {
      const response = await requestWithRetry(() =>
        api.get('/reports/export', {
          params: { ...params, format },
          responseType: format === 'json' ? 'json' : 'blob',
        })
      );

      if (format === 'json') {
        const blob = new Blob([JSON.stringify(response.data.report, null, 2)], {
          type: 'application/json',
        });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'reports.json';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } else {
        const blob = new Blob([response.data]);
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `reports.${format}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }

      toast.success(`Report exported as ${format.toUpperCase()}`);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to export report');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Dynamic Reports</h1>
          <p className="text-sm text-slate-300">Filter by date, ward, role, and appointment status. Export in JSON, CSV, XLSX.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => exportReport('json')} disabled={downloading || loading}>
            Export JSON
          </button>
          <button className="btn-secondary" onClick={() => exportReport('csv')} disabled={downloading || loading}>
            Export CSV
          </button>
          <button className="btn-secondary" onClick={() => exportReport('xlsx')} disabled={downloading || loading}>
            Export XLSX
          </button>
        </div>
      </div>

      <div className="card">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className="mb-1 block text-sm text-slate-300">Start Date</label>
            <input className="input-field" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-300">End Date</label>
            <input className="input-field" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-300">Ward</label>
            <select className="input-field" value={wardId} onChange={(e) => setWardId(e.target.value)}>
              <option value="">All wards</option>
              {wards.map((ward) => (
                <option key={ward.id} value={ward.id}>
                  {ward.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-300">Role</label>
            <select className="input-field" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="">All roles</option>
              <option value="admin">admin</option>
              <option value="doctor">doctor</option>
              <option value="nurse">nurse</option>
              <option value="patient">patient</option>
              <option value="caregiver">caregiver</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-300">Appointment Status</label>
            <select className="input-field" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              <option value="scheduled">scheduled</option>
              <option value="approved">approved</option>
              <option value="cancelled">cancelled</option>
              <option value="completed">completed</option>
              <option value="no_show">no_show</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <ReportsSkeleton />
      ) : !report ? (
        <div className="card text-center text-slate-300">No report data available for current filters.</div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <div className="card">
              <p className="text-sm text-slate-300">Total</p>
              <p className="mt-2 text-3xl font-bold text-slate-100">{report.overview.total}</p>
            </div>
            <div className="card">
              <p className="text-sm text-slate-300">Approved</p>
              <p className="mt-2 text-3xl font-bold text-emerald-200">{report.overview.approved}</p>
            </div>
            <div className="card">
              <p className="text-sm text-slate-300">Scheduled</p>
              <p className="mt-2 text-3xl font-bold text-blue-200">{report.overview.scheduled}</p>
            </div>
            <div className="card">
              <p className="text-sm text-slate-300">Cancelled</p>
              <p className="mt-2 text-3xl font-bold text-rose-200">{report.overview.cancelled}</p>
            </div>
            <div className="card">
              <p className="text-sm text-slate-300">Completed</p>
              <p className="mt-2 text-3xl font-bold text-violet-200">{report.overview.completed}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="card">
              <h2 className="mb-3 text-lg font-semibold text-slate-100">Appointment Status</h2>
              {report.appointment_status.length === 0 ? (
                <p className="text-sm text-slate-300">No appointment status data.</p>
              ) : (
                <div className="space-y-2">
                  {report.appointment_status.map((row) => (
                    <div key={row.status} className="flex items-center justify-between rounded border border-slate-700/50 px-3 py-2">
                      <span className="text-sm text-slate-200">{row.status}</span>
                      <span className="text-sm font-semibold text-slate-100">{row.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card">
              <h2 className="mb-3 text-lg font-semibold text-slate-100">Records by Type</h2>
              {report.record_types.length === 0 ? (
                <p className="text-sm text-slate-300">No record type data.</p>
              ) : (
                <div className="space-y-2">
                  {report.record_types.map((row) => (
                    <div key={row.record_type} className="flex items-center justify-between rounded border border-slate-700/50 px-3 py-2">
                      <span className="text-sm text-slate-200">{row.record_type}</span>
                      <span className="text-sm font-semibold text-slate-100">{row.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="card">
              <h2 className="mb-3 text-lg font-semibold text-slate-100">Ward Breakdown</h2>
              {report.wards.length === 0 ? (
                <p className="text-sm text-slate-300">No ward data.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700/60 text-left text-slate-300">
                        <th className="px-2 py-2">Ward</th>
                        <th className="px-2 py-2">Patients</th>
                        <th className="px-2 py-2">Appointments</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.wards.map((row) => (
                        <tr key={row.ward_id} className="border-b border-slate-800/60 text-slate-100">
                          <td className="px-2 py-2">{row.ward_name}</td>
                          <td className="px-2 py-2">{row.patient_count}</td>
                          <td className="px-2 py-2">{row.appointment_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="card">
              <h2 className="mb-3 text-lg font-semibold text-slate-100">Users by Role</h2>
              {report.user_roles.length === 0 ? (
                <p className="text-sm text-slate-300">No role distribution data.</p>
              ) : (
                <div className="space-y-2">
                  {report.user_roles.map((row) => (
                    <div key={row.role} className="flex items-center justify-between rounded border border-slate-700/50 px-3 py-2">
                      <span className="text-sm text-slate-200">{row.role}</span>
                      <span className="text-sm font-semibold text-slate-100">{row.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportsPage;
