import { createContext, useContext, useState, useCallback } from 'react';

const ToastCtx = createContext(null);

let id = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const add = useCallback((message, type = 'info') => {
    const key = ++id;
    setToasts(t => [...t, { key, message, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.key !== key)), 3500);
  }, []);

  const toast = {
    success: (msg) => add(msg, 'success'),
    error:   (msg) => add(msg, 'error'),
    info:    (msg) => add(msg, 'info'),
  };

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.key} className={`toast ${t.type === 'error' ? 'error' : t.type === 'success' ? 'success' : ''}`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  return useContext(ToastCtx);
}
