import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const removeToast = useCallback((id) => {
    setToasts((items) => items.filter((item) => item.id !== id))
  }, [])

  const addToast = useCallback(
    ({ title, message, type = 'info', duration = 4500 }) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
      setToasts((items) => [...items, { id, title, message, type }])
      if (duration) window.setTimeout(() => removeToast(id), duration)
      return id
    },
    [removeToast],
  )

  useEffect(() => {
    const handleForbidden = (event) => {
      addToast({
        type: 'warning',
        title: 'Permission denied',
        message: event.detail?.message || 'You are not allowed to perform that action.',
      })
    }
    window.addEventListener('api:forbidden', handleForbidden)
    return () => window.removeEventListener('api:forbidden', handleForbidden)
  }, [addToast])

  const value = useMemo(() => ({ addToast, removeToast }), [addToast, removeToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-viewport" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <div className={`toast toast--${toast.type}`} role="status" key={toast.id}>
            <div>
              {toast.title && <strong>{toast.title}</strong>}
              <p>{toast.message}</p>
            </div>
            <button type="button" onClick={() => removeToast(toast.id)} aria-label="Dismiss notification">
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const value = useContext(ToastContext)
  if (!value) throw new Error('useToast must be used within ToastProvider.')
  return value
}

