import { BottomSheet } from './BottomSheet'

export interface ConfirmRequest {
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
}

export function ConfirmSheet({
  request,
  onClose,
}: {
  request: ConfirmRequest
  onClose: () => void
}) {
  return (
    <BottomSheet title={request.title} onClose={onClose}>
      <p className="sheet__text">{request.message}</p>
      <div className="sheet-actions">
        <button className="btn btn--ghost" onClick={onClose}>
          Cancel
        </button>
        <button
          className="btn btn--danger"
          onClick={() => {
            request.onConfirm()
            onClose()
          }}
        >
          {request.confirmLabel ?? 'Delete'}
        </button>
      </div>
    </BottomSheet>
  )
}
