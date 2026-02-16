import { useState } from 'react';
import api from '../services/api';
import { Download, Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react';

const ExportImportPage = () => {
  const [exportType, setExportType] = useState<'patients' | 'appointments' | 'records'>('patients');
  const [exportFormat, setExportFormat] = useState<'json' | 'csv' | 'xlsx'>('json');
  const [importType, setImportType] = useState<'patients' | 'appointments' | 'records'>('patients');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleExport = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const response = await api.get(`/export/${exportType}`, {
        params: { format: exportFormat },
        responseType: 'blob',
      });

      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${exportType}.${exportFormat}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setMessage({ type: 'success', text: `Exported ${exportType} successfully!` });
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Export failed',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!importFile) {
      setMessage({ type: 'error', text: 'Please select a file' });
      return;
    }

    setLoading(true);
    setMessage(null);

    const formData = new FormData();
    formData.append('file', importFile);

    try {
      const response = await api.post(`/import/${importType}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      console.log('Import response:', response);
      console.log('Import response.data:', response.data);
      
      // Handle both direct response.data and nested structures
      const responseData = response.data || {};
      const successful = responseData.successful ?? responseData.count ?? 0;
      const failed = responseData.failed ?? 0;
      const total = responseData.total ?? 0;
      const results = responseData.results || {};
      
      console.log('Parsed values:', { successful, failed, total });
      
      if (failed > 0) {
        // Show errors if any
        const errorDetails = results?.errors?.slice(0, 3).map((e: any) => 
          `Row ${e.row}: ${e.errors?.join(', ') || 'Unknown error'}`
        ).join('; ') || 'Unknown errors';
        
        setMessage({
          type: 'error',
          text: `Imported ${successful}/${total} ${importType}. ${failed} failed. ${errorDetails}`,
        });
      } else if (successful > 0) {
        setMessage({
          type: 'success',
          text: `✓ Imported ${successful} ${importType} successfully!`,
        });
      } else {
        setMessage({
          type: 'error',
          text: `No ${importType} were imported. Check the file format and try again. Response: ${JSON.stringify(responseData)}`,
        });
      }
      setImportFile(null);
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.response?.data?.message || 'Import failed',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Export / Import Data</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Export Section */}
        <div className="card">
          <div className="flex items-center mb-6">
            <Download className="h-6 w-6 text-primary-600 mr-2" />
            <h2 className="text-2xl font-semibold text-gray-900">Export Data</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data Type
              </label>
              <select
                value={exportType}
                onChange={(e) => setExportType(e.target.value as any)}
                className="input-field"
              >
                <option value="patients">Patients</option>
                <option value="appointments">Appointments</option>
                <option value="records">Patient Records</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Format
              </label>
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value as any)}
                className="input-field"
              >
                <option value="json">JSON</option>
                <option value="csv">CSV</option>
                <option value="xlsx">Excel (XLSX)</option>
              </select>
            </div>

            <button
              onClick={handleExport}
              disabled={loading}
              className="w-full btn-primary flex items-center justify-center"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <>
                  <Download className="mr-2 h-5 w-5" />
                  Export {exportType}
                </>
              )}
            </button>
          </div>
        </div>

        {/* Import Section */}
        <div className="card">
          <div className="flex items-center mb-6">
            <Upload className="h-6 w-6 text-primary-600 mr-2" />
            <h2 className="text-2xl font-semibold text-gray-900">Import Data</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data Type
              </label>
              <select
                value={importType}
                onChange={(e) => setImportType(e.target.value as any)}
                className="input-field"
              >
                <option value="patients">Patients</option>
                <option value="appointments">Appointments</option>
                <option value="records">Patient Records</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                File (CSV, Excel, or JSON)
              </label>
              <input
                type="file"
                accept=".csv,.xlsx,.xls,.json"
                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                className="input-field"
              />
              {importFile && (
                <p className="mt-2 text-sm text-gray-600 flex items-center">
                  <FileText className="h-4 w-4 mr-1" />
                  {importFile.name}
                </p>
              )}
            </div>

            <button
              onClick={handleImport}
              disabled={loading || !importFile}
              className="w-full btn-primary flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <>
                  <Upload className="mr-2 h-5 w-5" />
                  Import {importType}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Message Display */}
      {message && (
        <div
          className={`mt-6 p-4 rounded-lg flex items-center ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="h-5 w-5 mr-2" />
          ) : (
            <AlertCircle className="h-5 w-5 mr-2" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Info Section */}
      <div className="mt-8 card bg-blue-50 border border-blue-200">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">📋 Instructions</h3>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>Export supports JSON, CSV, and Excel formats</li>
          <li>Import accepts CSV, Excel (.xlsx, .xls), and JSON files</li>
          <li>Make sure your import file matches the expected format</li>
          <li>For patients: include name, email, date_of_birth, gender, blood_type</li>
          <li>For appointments: include doctor_id, patient_id, appointment_date, status</li>
        </ul>
      </div>
    </div>
  );
};

export default ExportImportPage;
