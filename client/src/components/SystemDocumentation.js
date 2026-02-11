import React, { useState, useEffect, useRef } from 'react';
import { FileText, Printer, X, Download } from 'lucide-react';

const SystemDocumentation = ({ onClose }) => {
  const [documentation, setDocumentation] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const contentRef = useRef(null);

  useEffect(() => {
    loadDocumentation();
  }, []);

  const loadDocumentation = async () => {
    try {
      setLoading(true);
      // Load the markdown file from public folder
      const response = await fetch(`${process.env.PUBLIC_URL || ''}/SYSTEM_THESIS_DOCUMENTATION.md`);
      if (!response.ok) {
        throw new Error('Failed to load documentation');
      }
      const text = await response.text();
      setDocumentation(text);
      setError('');
    } catch (err) {
      console.error('Error loading documentation:', err);
      setError('Failed to load documentation. Please check if the file exists.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    setDownloadError('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/documentation/pdf', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `PDF failed (${res.status})`);
      }
      const contentType = res.headers.get('Content-Type') || '';
      if (!contentType.includes('application/pdf')) {
        throw new Error('Server did not return a PDF. Please try again.');
      }
      const blob = await res.blob();
      if (blob.size < 100 || !blob.type.includes('pdf')) {
        throw new Error('Downloaded file is not a valid PDF. Please try again.');
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'DELODUR_System_Documentation.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF download failed:', err);
      setDownloadError(err.message || 'Failed to generate PDF. Try Print → Save as PDF instead.');
    } finally {
      setDownloading(false);
    }
  };

  // Convert markdown to HTML for better display
  const convertMarkdownToHTML = (markdown) => {
    if (!markdown) return '';
    
    let html = markdown;
    
    // Horizontal rules
    html = html.replace(/^---$/gim, '<hr>');
    html = html.replace(/^\*\*\*$/gim, '<hr>');
    
    // Headers (process from largest to smallest)
    html = html.replace(/^#### (.*$)/gim, '<h4>$1</h4>');
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    
    // Bold and italic
    html = html.replace(/\*\*\*(.*?)\*\*\*/gim, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>');
    
    // Code blocks (preserve formatting)
    html = html.replace(/```([\s\S]*?)```/gim, (match, code) => {
      return '<pre><code>' + code.trim() + '</code></pre>';
    });
    html = html.replace(/`([^`]+)`/gim, '<code>$1</code>');
    
    // Tables
    const lines = html.split('\n');
    let inTable = false;
    let tableHTML = '';
    const processedLines = [];
    
    lines.forEach((line, index) => {
      if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
        if (!inTable) {
          inTable = true;
          tableHTML = '<table>\n';
        }
        const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell);
        if (cells.length > 0) {
          // Check if it's a header separator
          if (cells.every(cell => /^:?-+:?$/.test(cell))) {
            return; // Skip separator row
          }
          const isHeader = index > 0 && lines[index - 1].includes('|') && 
                          !lines[index - 1].split('|').some(c => /^:?-+:?$/.test(c.trim()));
          const tag = isHeader ? 'th' : 'td';
          tableHTML += '<tr>' + cells.map(cell => `<${tag}>${cell}</${tag}>`).join('') + '</tr>\n';
        }
      } else {
        if (inTable) {
          tableHTML += '</table>';
          processedLines.push(tableHTML);
          tableHTML = '';
          inTable = false;
        }
        processedLines.push(line);
      }
    });
    
    if (inTable) {
      tableHTML += '</table>';
      processedLines.push(tableHTML);
    }
    
    html = processedLines.join('\n');
    
    // Lists (unordered)
    html = html.replace(/^\- (.*$)/gim, '<li>$1</li>');
    html = html.replace(/^\* (.*$)/gim, '<li>$1</li>');
    
    // Lists (ordered)
    html = html.replace(/^\d+\. (.*$)/gim, '<li>$1</li>');
    
    // Wrap list items in ul/ol tags
    html = html.replace(/(<li>.*<\/li>)/gim, (match) => {
      return '<ul>' + match + '</ul>';
    });
    
    // Line breaks and paragraphs
    html = html.split('\n\n').map(para => {
      para = para.trim();
      if (!para || para.startsWith('<') || para.startsWith('#')) {
        return para;
      }
      return '<p>' + para + '</p>';
    }).join('\n');
    
    // Clean up empty paragraphs
    html = html.replace(/<p><\/p>/gim, '');
    html = html.replace(/<p>\s*<\/p>/gim, '');
    
    // Clean up multiple br tags
    html = html.replace(/(<br\s*\/?>){3,}/gim, '<br><br>');
    
    return html;
  };

  if (loading) {
    return (
      <div className="documentation-modal">
        <div className="documentation-content">
          <div className="documentation-loading">
            <FileText className="loading-icon" />
            <p>Loading documentation...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="documentation-modal">
        <div className="documentation-content">
          <div className="documentation-error">
            <p>{error}</p>
            <button onClick={onClose} className="btn btn-primary">Close</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @media print {
          .documentation-header,
          .documentation-actions,
          .no-print {
            display: none !important;
          }
          
          .documentation-content {
            margin: 0;
            padding: 20px;
            box-shadow: none;
            max-width: 100%;
          }
          
          body {
            background: white;
          }
          
          .documentation-text {
            font-size: 11pt;
            line-height: 1.6;
          }
          
          .documentation-text h1 {
            page-break-before: always;
            font-size: 18pt;
            margin-top: 20pt;
            margin-bottom: 12pt;
          }
          
          .documentation-text h2 {
            page-break-before: auto;
            font-size: 16pt;
            margin-top: 16pt;
            margin-bottom: 10pt;
          }
          
          .documentation-text h3 {
            font-size: 14pt;
            margin-top: 12pt;
            margin-bottom: 8pt;
          }
          
          .documentation-text pre {
            page-break-inside: avoid;
            font-size: 9pt;
          }
          
          .documentation-text table {
            page-break-inside: avoid;
          }
        }
        
        .documentation-modal {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          z-index: 10000;
          overflow-y: auto;
          padding: 20px;
        }
        
        .documentation-content {
          background: white;
          margin: 0 auto;
          max-width: 900px;
          min-height: calc(100vh - 40px);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
          border-radius: 8px;
          overflow: hidden;
        }
        
        .documentation-header {
          background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
          color: white;
          padding: 20px 30px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 2px solid #007bff;
        }
        
        .documentation-header h2 {
          margin: 0;
          font-size: 24px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        
        .documentation-actions {
          display: flex;
          gap: 10px;
        }
        
        .documentation-actions button {
          padding: 10px 20px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.3s;
        }
        
        .btn-print {
          background: #007bff;
          color: white;
        }
        
        .btn-print:hover {
          background: #0056b3;
        }
        
        .btn-download {
          background: #28a745;
          color: white;
        }
        
        .btn-download:hover {
          background: #218838;
        }
        
        .btn-close {
          background: #dc3545;
          color: white;
        }
        
        .btn-close:hover {
          background: #c82333;
        }
        
        .documentation-text {
          padding: 40px;
          line-height: 1.8;
          color: #333;
          font-family: 'Georgia', 'Times New Roman', serif;
          font-size: 12pt;
        }
        
        .documentation-text h1 {
          color: #1a1a1a;
          border-bottom: 3px solid #007bff;
          padding-bottom: 10px;
          margin-top: 40px;
          margin-bottom: 20px;
          font-size: 28px;
        }
        
        .documentation-text h2 {
          color: #2d2d2d;
          border-bottom: 2px solid #e0e0e0;
          padding-bottom: 8px;
          margin-top: 30px;
          margin-bottom: 15px;
          font-size: 22px;
        }
        
        .documentation-text h3 {
          color: #404040;
          margin-top: 25px;
          margin-bottom: 12px;
          font-size: 18px;
        }
        
        .documentation-text p {
          margin-bottom: 15px;
          text-align: justify;
        }
        
        .documentation-text ul,
        .documentation-text ol {
          margin: 15px 0;
          padding-left: 30px;
        }
        
        .documentation-text li {
          margin-bottom: 8px;
        }
        
        .documentation-text code {
          background: #f4f4f4;
          padding: 2px 6px;
          border-radius: 3px;
          font-family: 'Courier New', monospace;
          font-size: 11pt;
        }
        
        .documentation-text pre {
          background: #f8f8f8;
          border: 1px solid #e0e0e0;
          border-radius: 4px;
          padding: 15px;
          overflow-x: auto;
          margin: 20px 0;
        }
        
        .documentation-text pre code {
          background: none;
          padding: 0;
        }
        
        .documentation-text table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
        }
        
        .documentation-text table th,
        .documentation-text table td {
          border: 1px solid #ddd;
          padding: 12px;
          text-align: left;
        }
        
        .documentation-text table th {
          background: #f8f8f8;
          font-weight: 600;
        }
        
        .documentation-text blockquote {
          border-left: 4px solid #007bff;
          padding-left: 20px;
          margin: 20px 0;
          color: #666;
          font-style: italic;
        }
        
        .documentation-loading,
        .documentation-error {
          padding: 60px;
          text-align: center;
        }
        
        .documentation-download-error {
          background: #f8d7da;
          color: #721c24;
          padding: 12px 20px;
          margin: 0 30px 16px;
          border-radius: 6px;
          border: 1px solid #f5c6cb;
          font-size: 14px;
        }
        
        .documentation-loading .loading-icon {
          font-size: 48px;
          color: #007bff;
          margin-bottom: 20px;
          animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        .documentation-text strong {
          font-weight: 600;
          color: #1a1a1a;
        }
        
        .documentation-text hr {
          border: none;
          border-top: 2px solid #e0e0e0;
          margin: 30px 0;
        }
      `}</style>
      
      <div className="documentation-modal">
        <div className="documentation-content">
          <div className="documentation-header no-print">
            <h2>
              <FileText />
              System Documentation
            </h2>
            <div className="documentation-actions">
              <button className="btn-print" onClick={handlePrint}>
                <Printer />
                Print
              </button>
              <button className="btn-download" onClick={handleDownload} disabled={downloading}>
                <Download />
                {downloading ? 'Generating PDF…' : 'Download'}
              </button>
              <button className="btn-close" onClick={onClose}>
                <X />
                Close
              </button>
            </div>
          </div>
          {downloadError && (
            <div className="documentation-download-error no-print">
              {downloadError}
            </div>
          )}
          <div 
            ref={contentRef}
            className="documentation-text"
            dangerouslySetInnerHTML={{ __html: convertMarkdownToHTML(documentation) }}
          />
        </div>
      </div>
    </>
  );
};

export default SystemDocumentation;

