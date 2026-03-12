import React from 'react'
import { motion } from 'framer-motion'
import { theme } from '../../theme'

const cardStyle: React.CSSProperties = {
  background: theme.surface,
  borderRadius: 10,
  border: `1px solid ${theme.borderMuted}`,
  overflow: 'hidden',
  boxShadow: `0 0 20px ${theme.goldGlow}`,
  transition: 'transform 0.5s ease-in-out, box-shadow 0.5s ease-in-out',
}

export function Card({
  children,
  style,
  className,
  ...rest
}: {
  children: React.ReactNode
  style?: React.CSSProperties
  className?: string
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <motion.div
      style={{ ...cardStyle, ...style }}
      className={className}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeInOut' }}
      whileHover={{ scale: 1.05, boxShadow: `0 0 24px ${theme.goldGlow}` }}
    >
      <div {...rest}>{children}</div>
    </motion.div>
  )
}

export function CardHeader({
  title,
  action,
  style,
}: {
  title: string
  action?: React.ReactNode
  style?: React.CSSProperties
}) {
  return (
    <div
      style={{
        padding: '14px 20px',
        borderBottom: `1px solid ${theme.borderMuted}`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        ...style,
      }}
    >
      <h3
        style={{
          margin: 0,
          fontSize: 14,
          fontWeight: 600,
          color: theme.text,
          letterSpacing: '0.02em',
        }}
      >
        {title}
      </h3>
      {action}
    </div>
  )
}

export function CardBody({
  children,
  style,
}: {
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  return <div style={{ padding: 20, ...style }}>{children}</div>
}
