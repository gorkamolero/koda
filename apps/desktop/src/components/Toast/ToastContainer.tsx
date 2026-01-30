import { useNotifications } from '@/hooks/useNotifications'
import { Toast } from './Toast'

export function ToastContainer() {
  const { toasts, dismissToast } = useNotifications()

  if (toasts.length === 0) {
    return null
  }

  return (
    <div
      data-testid="toast-container"
      className="
        pointer-events-none fixed inset-0 z-50 flex flex-col items-end
        justify-end gap-2 p-4
      "
    >
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={dismissToast} />
      ))}
    </div>
  )
}
