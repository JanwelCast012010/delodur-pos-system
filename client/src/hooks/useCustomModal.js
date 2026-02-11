import { useState } from 'react';

const useCustomModal = () => {
  const [modalState, setModalState] = useState({
    show: false,
    type: 'alert',
    title: '',
    message: '',
    onConfirm: null
  });

  const showAlert = (message, title = 'Notification', autoClose = false, autoCloseDelay = 3000) => {
    return new Promise((resolve) => {
      setModalState({
        show: true,
        type: 'alert',
        title,
        message,
        onConfirm: null,
        onCancel: () => {
          setModalState({ show: false, type: 'alert', title: '', message: '', onConfirm: null, onCancel: null });
          resolve(true);
        }
      });

      // Auto-close after delay if enabled
      if (autoClose) {
        setTimeout(() => {
          setModalState({ show: false, type: 'alert', title: '', message: '', onConfirm: null, onCancel: null });
          resolve(true);
        }, autoCloseDelay);
      }
    });
  };

  const showConfirm = (message, title = 'Confirm') => {
    return new Promise((resolve) => {
      setModalState({
        show: true,
        type: 'confirm',
        title,
        message,
        onConfirm: () => {
          setModalState({ show: false, type: 'alert', title: '', message: '', onConfirm: null });
          resolve(true);
        },
        onCancel: () => {
          setModalState({ show: false, type: 'alert', title: '', message: '', onConfirm: null });
          resolve(false);
        }
      });
    });
  };

  const closeModal = () => {
    if (modalState.onCancel) {
      modalState.onCancel();
    } else if (modalState.onConfirm) {
      modalState.onConfirm();
    }
    setModalState({ show: false, type: 'alert', title: '', message: '', onConfirm: null });
  };

  return {
    modalState,
    showAlert,
    showConfirm,
    closeModal
  };
};

export default useCustomModal;

