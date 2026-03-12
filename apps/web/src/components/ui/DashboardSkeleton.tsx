import { motion } from 'framer-motion'

export function DashboardSkeleton() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="h-8 w-64 bg-[var(--armai-surface-elevated)] rounded animate-pulse" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div
            key={i}
            className="h-24 rounded-xl bg-[var(--armai-surface-elevated)] animate-pulse"
          />
        ))}
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="h-64 rounded-xl bg-[var(--armai-surface-elevated)] animate-pulse" />
        <div className="h-64 rounded-xl bg-[var(--armai-surface-elevated)] animate-pulse" />
      </div>
    </motion.div>
  )
}
