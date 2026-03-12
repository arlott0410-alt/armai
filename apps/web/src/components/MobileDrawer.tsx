import React, { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

/**
 * Bottom drawer for mobile nav. Accessible: focus trap, Escape to close, aria.
 */
export function MobileDrawer({
  open,
  onClose,
  children,
  title,
  'aria-label': ariaLabel = 'Mobile menu',
}: {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  title?: string
  'aria-label'?: string
}) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            role="presentation"
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel}
            className="fixed bottom-0 left-0 right-0 z-50 md:hidden max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-[var(--armai-border)] bg-[var(--armai-surface)] shadow-gold-lg"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            {title && (
              <div className="sticky top-0 flex items-center justify-between px-4 py-3 border-b border-[var(--armai-border-muted)] bg-[var(--armai-surface)]">
                <h2 className="text-sm font-semibold text-[var(--armai-text)]">{title}</h2>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 rounded-lg text-[var(--armai-text-muted)] hover:bg-[var(--armai-surface-elevated)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--armai-primary)]"
                  aria-label="Close menu"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
            <nav className="p-4 pb-8" role="navigation">
              {children}
            </nav>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
