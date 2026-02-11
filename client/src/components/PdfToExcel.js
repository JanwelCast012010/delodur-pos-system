import React, { useState, useContext } from 'react';
import { AuthContext } from '../AuthContext';
import { FileEarmarkPdf, FileEarmarkSpreadsheet, CloudUpload, ArrowClockwise } from 'react-bootstrap-icons';

const PdfToExcel = () => {
  const { user } = useContext(AuthContext);
  const token = localStorage.getItem('token');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const handleFile = (selectedFile) => {
    setError('');
    if (!selectedFile) {
      setFile(null);
      return;
    }
    if (selectedFile.type !== 'application/pdf' && !selectedFile.name.toLowerCase().endsWith('.pdf')) {
      setError('Please select a PDF file.');
      setFile(null);
      return;
    }
    if (selectedFile.size > 15 * 1024 * 1024) {
      setError('File is too large. Maximum size is 15 MB.');
      setFile(null);
      return;
    }
    setFile(selectedFile);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer?.files?.[0];
    if (f) handleFile(f);
  };

  const onDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const onDragLeave = () => setDragOver(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a PDF file first.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('pdf', file);
      const res = await fetch('/api/pdf-to-excel', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const contentType = res.headers.get('content-type') || '';
      if (!res.ok) {
        const data = contentType.includes('application/json') ? await res.json().catch(() => ({})) : {};
        throw new Error(data.message || `Server error: ${res.status}`);
      }
      if (!contentType.includes('spreadsheet') && !contentType.includes('octet-stream')) {
        const text = await res.text();
        try {
          const data = JSON.parse(text);
          throw new Error(data.message || 'Unexpected response');
        } catch (parseErr) {
          if (parseErr.message) throw parseErr;
          throw new Error('Server did not return an Excel file.');
        }
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.headers.get('content-disposition')?.split('filename=')?.[1]?.replace(/"/g, '') || 'extracted-line-items.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setFile(null);
    } catch (err) {
      setError(err.message || 'Failed to process PDF');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-fluid py-4" style={{ maxWidth: 720 }}>
      <h4 className="mb-3 d-flex align-items-center gap-2">
        <FileEarmarkSpreadsheet size={24} />
        PDF to Excel
      </h4>
      <p className="text-muted mb-4">
        Upload an invoice or order PDF. AI will extract line items (Ref No., Description, Quantity, Price, etc.) and download an Excel file. Works best with supplier invoices like Bilstein.
      </p>

      <form onSubmit={handleSubmit}>
        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          style={{
            border: `2px dashed ${dragOver ? 'var(--bs-primary)' : 'var(--border-color, #dee2e6)'}`,
            borderRadius: 12,
            padding: 32,
            textAlign: 'center',
            background: dragOver ? 'var(--hover-bg, rgba(0,123,255,0.05))' : 'var(--bg-secondary, #f8f9fa)',
            cursor: 'pointer'
          }}
          onClick={() => document.getElementById('pdf-input').click()}
        >
          <input
            id="pdf-input"
            type="file"
            accept=".pdf,application/pdf"
            className="d-none"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          {file ? (
            <div>
              <FileEarmarkPdf size={48} className="text-danger mb-2" />
              <div className="fw-semibold">{file.name}</div>
              <small className="text-muted">{(file.size / 1024).toFixed(1)} KB · Click or drop another file to change</small>
            </div>
          ) : (
            <div>
              <CloudUpload size={48} className="text-muted mb-2" />
              <div className="fw-semibold">Drop a PDF here or click to choose</div>
              <small className="text-muted">Max 15 MB · Invoice / order PDFs only</small>
            </div>
          )}
        </div>

        {error && (
          <div className="alert alert-danger mt-3 mb-0" role="alert">
            {error}
          </div>
        )}

        <div className="mt-3 d-flex gap-2">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={!file || loading}
          >
            {loading ? (
              <>
                <ArrowClockwise className="me-2" style={{ animation: 'spin 0.8s linear infinite' }} />
                Extracting…
              </>
            ) : (
              <>
                <FileEarmarkSpreadsheet className="me-2" />
                Extract to Excel
              </>
            )}
          </button>
          {file && !loading && (
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => { setFile(null); setError(''); }}
            >
              Clear
            </button>
          )}
        </div>
      </form>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default PdfToExcel;
