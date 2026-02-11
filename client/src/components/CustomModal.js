import React from 'react';
import './CustomModal.css';

const CustomModal = ({ show, type = 'alert', title, message, onConfirm, onCancel }) => {
  if (!show) return null;

  const handleOverlayClick = () => {
    if (onCancel) {
      onCancel();
    }
  };

  const handleModalClick = (e) => {
    e.stopPropagation();
  };

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
  };

  return (
    <div className="custom-modal-overlay" onClick={handleOverlayClick}>
      <div className="custom-modal" onClick={handleModalClick}>
        <div className="custom-modal-header">
          <h3>{title}</h3>
          <button className="modal-close-btn" onClick={handleCancel}>&times;</button>
        </div>
        <div className="custom-modal-body">
          <p>{message}</p>
        </div>
        <div className="custom-modal-footer">
          {type === 'confirm' ? (
            <>
              <button className="btn btn-secondary" onClick={handleCancel}>Cancel</button>
              <button className="btn btn-primary" onClick={handleConfirm}>OK</button>
            </>
          ) : (
            <button className="btn btn-primary" onClick={handleCancel}>OK</button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomModal;

