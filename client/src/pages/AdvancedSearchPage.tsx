import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { requestWithRetry } from '../services/request';
import { useToast } from '../contexts/ToastContext';

const SEARCH_ENTITIES = ['patients', 'doctors', 'appointments', 'records', 'users'] as const;
type SearchEntity = (typeof SEARCH_ENTITIES)[number];

type SortOption = {
  value: string;
  label: string;
};

const SORT_OPTIONS: Record<SearchEntity, SortOption[]> = {
  patients: [
    { value: 'name', label: 'Name' },
    { value: 'email', label: 'Email' },
    { value: 'ward_name', label: 'Ward' },
    { value: 'created_at', label: 'Created' },
  ],
  doctors: [
    { value: 'name', label: 'Name' },
    { value: 'email', label: 'Email' },
    { value: 'specialization', label: 'Specialization' },
    { value: 'created_at', label: 'Created' },
  ],
  appointments: [
    { value: 'appointment_date', label: 'Appointment Date' },
    { value: 'status', label: 'Status' },
    { value: 'doctor_name', label: 'Doctor' },
    { value: 'patient_name', label: 'Patient' },
    { value: 'created_at', label: 'Created' },
  ],
  records: [
    { value: 'created_at', label: 'Created' },
    { value: 'record_type', label: 'Record Type' },
    { value: 'patient_name', label: 'Patient' },
    { value: 'created_by', label: 'Created By' },
  ],
  users: [
    { value: 'created_at', label: 'Created' },
    { value: 'name', label: 'Name' },
    { value: 'email', label: 'Email' },
    { value: 'role', label: 'Role' },
  ],
};

const PAGE_SIZE = 20;

const SkeletonList = () => (
  <div className="space-y-3">
    {Array.from({ length: 5 }).map((_, index) => (
      <div key={index} className="card animate-pulse">
        <div className="h-4 w-2/5 rounded bg-slate-700/60"></div>
        <div className="mt-3 h-3 w-3/5 rounded bg-slate-800/70"></div>
        <div className="mt-2 h-3 w-4/5 rounded bg-slate-800/70"></div>
      </div>
    ))}
  </div>
);

const AdvancedSearchPage = () => {
  const toast = useToast();
  const [entity, setEntity] = useState<SearchEntity>('patients');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const [wardId, setWardId] = useState('');
  const [status, setStatus] = useState('');
  const [role, setRole] = useState('');
  const [recordType, setRecordType] = useState('');
  const [sortBy, setSortBy] = useState(SORT_OPTIONS.patients[0].value);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [wards, setWards] = useState<any[]>([]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 350);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const firstSort = SORT_OPTIONS[entity][0]?.value || 'created_at';
    setSortBy(firstSort);
    setPage(1);
  }, [entity]);

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

  const params = useMemo(() => {
    const next: Record<string, string | number> = {
      page,
      limit: PAGE_SIZE,
      sort_by: sortBy,
      sort_order: sortOrder,
    };

    if (debouncedQuery) next.q = debouncedQuery;
    if (wardId && ['patients', 'appointments', 'records'].includes(entity)) next.ward_id = wardId;
    if (status && entity === 'appointments') next.status = status;
    if (role && entity === 'users') next.role = role;
    if (recordType && entity === 'records') next.record_type = recordType;

    return next;
  }, [debouncedQuery, wardId, status, role, recordType, entity, page, sortBy, sortOrder]);

  useEffect(() => {
    const fetchResults = async () => {
      setLoading(true);
      try {
        const response = await requestWithRetry(() =>
          api.get(`/search/${entity}`, {
            params,
          })
        );
        setItems(response.data.items || []);
        setCount(response.data.count || 0);
      } catch (error: any) {
        setItems([]);
        setCount(0);
        toast.error(error.response?.data?.message || 'Failed to search data');
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [entity, params, toast]);

  const totalPages = Math.max(Math.ceil(count / PAGE_SIZE), 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-100">Advanced Search</h1>
        <p className="mt-1 text-sm text-slate-300">
          Debounced search, filter, and sorting across patients, doctors, appointments, records, and users.
        </p>
      </div>

      <div className="card space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm text-slate-300">Entity</label>
            <select className="input-field" value={entity} onChange={(e) => setEntity(e.target.value as SearchEntity)}>
              {SEARCH_ENTITIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-300">Search</label>
            <input
              className="input-field"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Type to search..."
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-300">Sort By</label>
            <select className="input-field" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              {SORT_OPTIONS[entity].map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-300">Sort Order</label>
            <select className="input-field" value={sortOrder} onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}>
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </div>

          {['patients', 'appointments', 'records'].includes(entity) && (
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
          )}

          {entity === 'appointments' && (
            <div>
              <label className="mb-1 block text-sm text-slate-300">Status</label>
              <select className="input-field" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">All statuses</option>
                <option value="scheduled">scheduled</option>
                <option value="approved">approved</option>
                <option value="cancelled">cancelled</option>
                <option value="completed">completed</option>
                <option value="no_show">no_show</option>
              </select>
            </div>
          )}

          {entity === 'users' && (
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
          )}

          {entity === 'records' && (
            <div>
              <label className="mb-1 block text-sm text-slate-300">Record Type</label>
              <input
                className="input-field"
                placeholder="e.g. diagnosis"
                value={recordType}
                onChange={(e) => setRecordType(e.target.value)}
              />
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-300">
        <span>{count} total results</span>
        <span>
          Page {page} of {totalPages}
        </span>
      </div>

      {loading ? (
        <SkeletonList />
      ) : items.length === 0 ? (
        <div className="card text-center text-slate-300">No results for current filters.</div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={`${entity}-${item.id}-${item.user_id || ''}`} className="card">
              {entity === 'patients' && (
                <>
                  <div className="text-base font-semibold text-slate-100">{item.name}</div>
                  <div className="mt-1 text-sm text-slate-300">{item.email}</div>
                  <div className="mt-2 text-sm text-slate-300">Ward: {item.ward_name || 'Unassigned'}</div>
                </>
              )}

              {entity === 'doctors' && (
                <>
                  <div className="text-base font-semibold text-slate-100">{item.name}</div>
                  <div className="mt-1 text-sm text-slate-300">{item.email}</div>
                  <div className="mt-2 text-sm text-slate-300">Specialization: {item.specialization}</div>
                </>
              )}

              {entity === 'appointments' && (
                <>
                  <div className="text-base font-semibold text-slate-100">{item.patient_name} with {item.doctor_name}</div>
                  <div className="mt-1 text-sm text-slate-300">{new Date(item.appointment_date).toLocaleString()}</div>
                  <div className="mt-2 text-sm text-slate-300">Status: {item.status}</div>
                </>
              )}

              {entity === 'records' && (
                <>
                  <div className="text-base font-semibold text-slate-100">{item.patient_name}</div>
                  <div className="mt-1 text-sm text-slate-300">Type: {item.record_type}</div>
                  <div className="mt-2 line-clamp-3 text-sm text-slate-300">{item.content}</div>
                </>
              )}

              {entity === 'users' && (
                <>
                  <div className="text-base font-semibold text-slate-100">{item.name}</div>
                  <div className="mt-1 text-sm text-slate-300">{item.email}</div>
                  <div className="mt-2 text-sm text-slate-300">Roles: {item.roles || 'N/A'}</div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        <button className="btn-secondary" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(p - 1, 1))}>
          Previous
        </button>
        <button
          className="btn-secondary"
          disabled={page >= totalPages || loading}
          onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default AdvancedSearchPage;
