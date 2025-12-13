const fs = require('fs');
const path = require('path');

/**
 * Simple DBF (DBASE/Clipper) file reader
 * Reads the binary DBF format and converts to JavaScript objects
 */
class DBFReader {
  constructor(filePath) {
    this.filePath = filePath;
    this.header = null;
    this.records = [];
  }

  /**
   * Read and parse the DBF file
   */
  async read() {
    try {
      const buffer = fs.readFileSync(this.filePath);
      this.parseHeader(buffer);
      this.parseRecords(buffer);
      return this.records;
    } catch (error) {
      console.error('Error reading DBF file:', error);
      throw error;
    }
  }

  /**
   * Parse the DBF file header
   */
  parseHeader(buffer) {
    // DBF header structure
    const version = buffer.readUInt8(0);
    const year = 1900 + buffer.readUInt8(1);
    const month = buffer.readUInt8(2);
    const day = buffer.readUInt8(3);
    const recordCount = buffer.readUInt32LE(4);
    const headerLength = buffer.readUInt16LE(8);
    const recordLength = buffer.readUInt16LE(10);

    this.header = {
      version,
      date: new Date(year, month - 1, day),
      recordCount,
      headerLength,
      recordLength
    };

    // Parse field descriptors
    this.fields = [];
    let offset = 32; // Start of field descriptors

    while (offset < headerLength - 1) {
      const rawFieldName = buffer.toString('ascii', offset, offset + 11).replace(/\0/g, '');
      
      if (rawFieldName === '') break;

      // Clean field name by removing special characters and trimming
      const fieldName = rawFieldName.replace(/[^A-Za-z0-9]/g, '').trim();
      
      if (fieldName === '') {
        offset += 32;
        continue;
      }

      const fieldType = buffer.toString('ascii', offset + 11, offset + 12);
      const fieldLength = buffer.readUInt8(offset + 16);
      const fieldDecimals = buffer.readUInt8(offset + 17);

      this.fields.push({
        name: fieldName,
        type: fieldType,
        length: fieldLength,
        decimals: fieldDecimals
      });

      offset += 32;
    }

    console.log(`📊 DBF Header: ${recordCount} records, ${this.fields.length} fields`);
    console.log(`📋 Fields:`, this.fields.map(f => `${f.name}(${f.type}${f.length})`).join(', '));
  }

  /**
   * Parse the DBF records
   */
  parseRecords(buffer) {
    const { headerLength, recordLength, recordCount } = this.header;
    this.records = [];
    let deletedCount = 0;

    console.log(`🔍 Processing ${recordCount} total records from DBF header...`);

    for (let i = 0; i < recordCount; i++) {
      const recordOffset = headerLength + (i * recordLength);
      
      // Check if record is deleted (first byte = 0x2A)
      if (buffer.readUInt8(recordOffset) === 0x2A) {
        deletedCount++;
        continue; // Skip deleted records
      }

      const record = {};
      let fieldOffset = recordOffset + 1; // Skip deletion flag

      for (const field of this.fields) {
        let rawValue = buffer.toString('ascii', fieldOffset, fieldOffset + field.length).trim();
        
        // Convert based on field type
        switch (field.type) {
          case 'N': // Numeric
            if (rawValue === '' || rawValue === null) {
              record[field.name] = null;
            } else {
              const numValue = parseFloat(rawValue);
              record[field.name] = isNaN(numValue) ? null : numValue;
            }
            break;
          case 'C': // Character
            record[field.name] = rawValue === '' ? null : rawValue;
            break;
          case 'D': // Date (stored as YYYYMMDD in DBF)
            if (rawValue === '' || rawValue === null || rawValue.length !== 8) {
              record[field.name] = null;
            } else {
              // DBF dates are stored as YYYYMMDD (8 characters)
              const year = rawValue.substring(0, 4);
              const month = rawValue.substring(4, 6);
              const day = rawValue.substring(6, 8);
              // Validate date components
              if (year >= '1900' && year <= '2100' && month >= '01' && month <= '12' && day >= '01' && day <= '31') {
                record[field.name] = `${year}-${month}-${day}`;
              } else {
                record[field.name] = null;
              }
            }
            break;
          case 'L': // Logical
            record[field.name] = rawValue === 'T' || rawValue === 'Y' || rawValue === 't' || rawValue === 'y';
            break;
          default:
            record[field.name] = rawValue === '' ? null : rawValue;
        }

        fieldOffset += field.length;
      }

      this.records.push(record);
    }

    console.log(`✅ DBF Parsing Results:`);
    console.log(`   - Total records in file: ${recordCount}`);
    console.log(`   - Deleted records skipped: ${deletedCount}`);
    console.log(`   - Active records parsed: ${this.records.length}`);
    console.log(`   - Deletion rate: ${((deletedCount / recordCount) * 100).toFixed(1)}%`);
  }

  /**
   * Convert records to CSV format
   */
  toCSV() {
    if (this.records.length === 0) {
      return '';
    }

    // Get headers from first record
    const headers = Object.keys(this.records[0]);
    
    // Create CSV content
    const csvRows = [headers.join(',')];
    
    for (const record of this.records) {
      const row = headers.map(header => {
        const value = record[header];
        // Escape commas and quotes in CSV
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value || '';
      });
      csvRows.push(row.join(','));
    }

    return csvRows.join('\n');
  }

  /**
   * Save records as CSV file
   */
  async saveAsCSV(outputPath) {
    console.log(`📝 Starting CSV conversion for ${this.records.length} records...`);
    const csvContent = this.toCSV();
    console.log(`📄 CSV content length: ${csvContent.length} characters`);
    console.log(`📂 Writing to: ${outputPath}`);
    
    try {
      fs.writeFileSync(outputPath, csvContent, 'utf8');
      console.log(`💾 Saved CSV file: ${outputPath}`);
      
      // Verify the file was written
      if (fs.existsSync(outputPath)) {
        const stats = fs.statSync(outputPath);
        console.log(`✅ CSV file verified: ${stats.size} bytes`);
      } else {
        throw new Error('CSV file was not created');
      }
      
      return outputPath;
    } catch (writeError) {
      console.error('❌ Failed to write CSV file:', writeError);
      throw writeError;
    }
  }
}

module.exports = DBFReader;
