import React, { useState, useRef, useEffect } from 'react';

// Simplified currency data for testing
const currencies = [
  { code: 'USD', name: 'US Dollar', flag: '🇺🇸', country: 'United States' },
  { code: 'EUR', name: 'Euro', flag: '🇪🇺', country: 'European Union' },
  { code: 'GBP', name: 'British Pound Sterling', flag: '🇬🇧', country: 'United Kingdom' },
  { code: 'JPY', name: 'Japanese Yen', flag: '🇯🇵', country: 'Japan' },
  { code: 'CAD', name: 'Canadian Dollar', flag: '🇨🇦', country: 'Canada' },
  { code: 'AUD', name: 'Australian Dollar', flag: '🇦🇺', country: 'Australia' },
  { code: 'CHF', name: 'Swiss Franc', flag: '🇨🇭', country: 'Switzerland' },
  { code: 'CNY', name: 'Chinese Yuan', flag: '🇨🇳', country: 'China' },
  { code: 'PHP', name: 'Philippine Peso', flag: '🇵🇭', country: 'Philippines' },
  { code: 'INR', name: 'Indian Rupee', flag: '🇮🇳', country: 'India' }
];

const CurrencyDropdown = ({ value, onChange, placeholder = "USD", disabled = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredCurrencies, setFilteredCurrencies] = useState(currencies);
  
  const dropdownRef = useRef(null);

  // Filter currencies based on search query
  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = currencies.filter(currency => 
        currency.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        currency.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        currency.country.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredCurrencies(filtered);
    } else {
      setFilteredCurrencies(currencies);
    }
  }, [searchQuery]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleInputChange = (e) => {
    const inputValue = e.target.value.toUpperCase();
    setSearchQuery(inputValue);
    setIsOpen(true);
    onChange(inputValue);
  };

  const handleCurrencySelect = (currency) => {
    setSearchQuery('');
    setIsOpen(false);
    onChange(currency.code);
  };

  const handleInputFocus = () => {
    setIsOpen(true);
    setSearchQuery('');
  };

  const handleInputKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setSearchQuery('');
    }
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative', width: '100%' }}>
      {/* Input Field */}
      <input
        type="text"
        value={value || ''}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        onKeyDown={handleInputKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        maxLength="5"
        autoComplete="off"
        style={{
          padding: '8px 12px',
          borderRadius: '6px',
          border: '1px solid #555',
          background: '#1a1a1a',
          color: '#e0e0e0',
          width: '100%',
          fontSize: '13px',
          fontWeight: '500',
          boxSizing: 'border-box',
          outline: 'none'
        }}
      />

      {/* Dropdown */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: '#2d2d2d',
            border: '1px solid #555',
            borderRadius: '6px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            zIndex: 1000,
            maxHeight: '300px',
            overflowY: 'auto',
            marginTop: '2px'
          }}
        >
          {filteredCurrencies.length > 0 ? (
            filteredCurrencies.slice(0, 10).map((currency, index) => (
              <div
                key={currency.code}
                onClick={() => handleCurrencySelect(currency)}
                style={{
                  padding: '10px 12px',
                  cursor: 'pointer',
                  borderBottom: index < Math.min(filteredCurrencies.length, 10) - 1 ? '1px solid #444' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = '#3d3d3d';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = 'transparent';
                }}
              >
                <span style={{ fontSize: '16px' }}>{currency.flag}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ 
                    color: '#ffffff', 
                    fontSize: '13px', 
                    fontWeight: '500',
                    marginBottom: '2px'
                  }}>
                    {currency.code}
                  </div>
                  <div style={{ 
                    color: '#b0b0b0', 
                    fontSize: '11px',
                    lineHeight: '1.2'
                  }}>
                    {currency.name}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div style={{
              padding: '12px',
              color: '#888',
              fontSize: '13px',
              textAlign: 'center'
            }}>
              No currencies found
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CurrencyDropdown;
