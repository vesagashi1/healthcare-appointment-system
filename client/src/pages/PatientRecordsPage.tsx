import { useState, useEffect } from 'react';
import api from '../services/api';
import { FileText, Calendar, Plus, Edit, Trash2, X } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import styles from './PatientRecordsPage.module.css';

interface Record {
  id: number;
  record_type: string;
  content: string;
  created_by_name?: string;
  patient_name?: string;
  patient_id?: number;
  created_at: string;
  corrected_record_id?: number;
  original_record_id?: number;
  original_content?: string;
}

const PatientRecordsPage = () => {
  const { user } = useAuth();
  const [records, setRecords] = useState<Record[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<Record | null>(null);
  const [formData, setFormData] = useState({
    patient_id: '',
    record_type: 'diagnosis',
    content: '',
  });
  const [patients, setPatients] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchRecords();
    if (user?.role === 'admin' || user?.role === 'doctor') {
      fetchPatients();
    }
  }, [user]);

  const fetchRecords = async () => {
    try {
      const response = await api.get('/patients/my-profile/records');
      setRecords(response.data.records || []);
    } catch (error) {
      console.error('Error fetching records:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPatients = async () => {
    try {
      const response = await api.get('/patients');
      setPatients(response.data.patients || []);
    } catch (error) {
      console.error('Error fetching patients:', error);
    }
  };

  const handleCreate = () => {
    setEditingRecord(null);
    setFormData({
      patient_id: '',
      record_type: 'diagnosis',
      content: '',
    });
    setShowModal(true);
  };

  const handleEdit = (record: Record) => {
    setEditingRecord(record);
    setFormData({
      patient_id: record.patient_id?.toString() || '',
      record_type: record.record_type,
      content: record.content,
    });
    setShowModal(true);
  };

  const handleDelete = async (recordId: number) => {
    if (!confirm('Are you sure you want to void this record? The original record will be preserved for audit purposes, and a void record will be created.')) {
      return;
    }

    try {
      await api.delete(`/patients/records/${recordId}`);
      alert('Record voided successfully. The original record is preserved for audit.');
      fetchRecords();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to void record');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (editingRecord) {
        await api.patch(`/patients/records/${editingRecord.id}`, {
          record_type: formData.record_type,
          content: formData.content,
        });
        alert('Correction record created successfully. The original record is preserved for audit.');
      } else {
        if (user?.role === 'patient') {
          await api.post('/patients/my-profile/records', {
            record_type: formData.record_type,
            content: formData.content,
          });
        } else {
          const patient = patients.find(
            (p: any) => p.user_id === parseInt(formData.patient_id)
          );
          
          if (!patient) {
            throw new Error('Patient not found');
          }
          
          await api.post(`/patients/${patient.id}/records`, {
            record_type: formData.record_type,
            content: formData.content,
          });
        }
      }
      
      setShowModal(false);
      fetchRecords();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to save record');
    } finally {
      setSubmitting(false);
    }
  };

  const getRecordTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'diagnosis':
        return styles.tagDiagnosis;
      case 'treatment_plan':
      case 'treatment':
        return styles.tagTreatment;
      case 'lab_results':
      case 'lab results':
        return styles.tagLab;
      case 'nursing_note':
        return styles.tagNursing;
      case 'patient_note':
        return styles.tagPatient;
      case 'void':
        return styles.tagVoid;
      default:
        return styles.tagDefault;
    }
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <FileText className={styles.headerIcon} />
          <h1 className={styles.title}>Patient Records</h1>
        </div>
        {(user?.role === 'admin' || user?.role === 'doctor' || user?.role === 'nurse') && (
          <button onClick={handleCreate} className={styles.createBtn}>
            <Plus className={styles.btnIcon} />
            Create Record
          </button>
        )}
      </div>

      {records.length === 0 ? (
        <div className={styles.emptyState}>
          <FileText className={styles.emptyIcon} />
          <p className={styles.emptyText}>No records found</p>
          {(user?.role === 'admin' || user?.role === 'doctor' || user?.role === 'nurse') && (
            <button onClick={handleCreate} className={styles.createBtn}>
              <Plus className={styles.btnIcon} />
              Create First Record
            </button>
          )}
        </div>
      ) : (
        <div className={styles.recordsList}>
          {records.map((record) => (
            <div key={record.id} className={styles.recordCard}>
              <div className={styles.recordHeader}>
                <div className={styles.recordHeaderLeft}>
                  <span className={`${styles.tag} ${getRecordTypeColor(record.record_type)}`}>
                    {record.record_type.replace('_', ' ')}
                  </span>
                  {record.patient_name && (
                    <span className={styles.patientName}>{record.patient_name}</span>
                  )}
                </div>
                <div className={styles.recordHeaderRight}>
                  <div className={styles.date}>
                    <Calendar className={styles.dateIcon} />
                    {format(new Date(record.created_at), 'PP')}
                  </div>
                  {(user?.role === 'admin' || user?.role === 'doctor') && (
                    <div className={styles.actions}>
                      {record.record_type !== 'void' && !record.corrected_record_id && (
                        <>
                          <button
                            onClick={() => handleEdit(record)}
                            className={styles.editBtn}
                            title="Correct record (creates new correction)"
                          >
                            <Edit className={styles.actionIcon} />
                          </button>
                          <button
                            onClick={() => handleDelete(record.id)}
                            className={styles.deleteBtn}
                            title="Void record (preserves original)"
                          >
                            <Trash2 className={styles.actionIcon} />
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {record.corrected_record_id && (
                <div className={styles.correctionBadge}>
                  <span className={styles.correctionLabel}>Correction of record #{record.corrected_record_id}</span>
                </div>
              )}
              {record.record_type === 'void' && (
                <div className={styles.voidBadge}>
                  <span className={styles.voidLabel}>VOIDED</span>
                </div>
              )}
              <p className={styles.content}>{record.content}</p>
              {record.created_by_name && (
                <p className={styles.createdBy}>Created by: {record.created_by_name}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>
                {editingRecord ? 'Correct Record (Creates New Correction)' : 'Create New Record'}
              </h2>
              <button onClick={() => setShowModal(false)} className={styles.closeBtn}>
                <X className={styles.closeIcon} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className={styles.form}>
              {(user?.role === 'admin' || user?.role === 'doctor') && (
                <div className={styles.field}>
                  <label className={styles.label}>Patient</label>
                  <select
                    className={styles.select}
                    value={formData.patient_id}
                    onChange={(e) => setFormData({ ...formData, patient_id: e.target.value })}
                    required={!editingRecord}
                    disabled={!!editingRecord}
                  >
                    <option value="">Select a patient</option>
                    {patients.map((patient) => (
                      <option key={patient.id} value={patient.user_id}>
                        {patient.name} ({patient.email})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className={styles.field}>
                <label className={styles.label}>Record Type</label>
                <select
                  className={styles.select}
                  value={formData.record_type}
                  onChange={(e) => setFormData({ ...formData, record_type: e.target.value })}
                  required
                >
                  <option value="diagnosis">Diagnosis</option>
                  <option value="treatment_plan">Treatment Plan</option>
                  <option value="lab_results">Lab Results</option>
                  <option value="nursing_note">Nursing Note</option>
                  <option value="patient_note">Patient Note</option>
                </select>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Content</label>
                <textarea
                  className={styles.textarea}
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Enter record details..."
                  rows={6}
                  required
                />
              </div>

              <div className={styles.modalActions}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className={styles.cancelBtn}
                >
                  Cancel
                </button>
                <button type="submit" className={styles.submitBtn} disabled={submitting}>
                  {submitting ? 'Saving...' : editingRecord ? 'Create Correction' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientRecordsPage;
