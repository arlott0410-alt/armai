import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'

import Login from './pages/Login'
import Pricing from './pages/Pricing'
import CheckoutSuccess from './pages/CheckoutSuccess'
import CheckoutError from './pages/CheckoutError'
import SuperLayout from './layouts/SuperLayout'
import MerchantLayout from './layouts/MerchantLayout'
import SuperDashboard from './pages/super/SuperDashboard'
import SuperMerchants from './pages/super/SuperMerchants'
import SuperMerchantDetail from './pages/super/SuperMerchantDetail'
import SuperBilling from './pages/super/SuperBilling'
import SuperSupport from './pages/super/SuperSupport'
import SuperAudit from './pages/super/SuperAudit'
import SuperPlans from './pages/super/SuperPlans'
import MerchantDashboard from './pages/merchant/MerchantDashboard'
import MerchantOrders from './pages/merchant/MerchantOrders'
import MerchantBankSync from './pages/merchant/MerchantBankSync'
import MerchantSettings from './pages/merchant/MerchantSettings'
import MerchantProducts from './pages/merchant/MerchantProducts'
import MerchantCategories from './pages/merchant/MerchantCategories'
import MerchantKnowledge from './pages/merchant/MerchantKnowledge'
import MerchantPromotions from './pages/merchant/MerchantPromotions'
import MerchantPaymentAccounts from './pages/merchant/MerchantPaymentAccounts'
import MerchantOrderDetail from './pages/merchant/MerchantOrderDetail'
import MerchantTelegram from './pages/merchant/MerchantTelegram'
import MerchantChannels from './pages/merchant/MerchantChannels'
import MerchantCustomers from './pages/merchant/MerchantCustomers'
import MerchantCustomerDetail from './pages/merchant/MerchantCustomerDetail'
import MerchantOperationsFeed from './pages/merchant/MerchantOperationsFeed'

function ProtectedRoute({
  children,
  requireSuper,
}: {
  children: React.ReactNode
  requireSuper?: boolean
}) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-[var(--armai-bg)]"
        role="status"
        aria-live="polite"
      >
        <div
          className="h-8 w-48 bg-[var(--armai-surface-elevated)] rounded animate-pulse"
          aria-hidden
        />
        <span className="sr-only">Loading</span>
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  if (requireSuper && user.role !== 'super_admin')
    return <Navigate to="/merchant/dashboard" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/super"
        element={
          <ProtectedRoute requireSuper>
            <SuperLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/super/dashboard" replace />} />
        <Route path="dashboard" element={<SuperDashboard />} />
        <Route path="merchants" element={<SuperMerchants />} />
        <Route path="merchants/:id" element={<SuperMerchantDetail />} />
        <Route path="billing" element={<SuperBilling />} />
        <Route path="support" element={<SuperSupport />} />
        <Route path="audit" element={<SuperAudit />} />
        <Route path="plans" element={<SuperPlans />} />
      </Route>
      <Route
        path="/merchant"
        element={
          <ProtectedRoute>
            <MerchantLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/merchant/dashboard" replace />} />
        <Route path="dashboard" element={<MerchantDashboard />} />
        <Route path="orders/:orderId" element={<MerchantOrderDetail />} />
        <Route path="orders" element={<MerchantOrders />} />
        <Route path="products" element={<MerchantProducts />} />
        <Route path="categories" element={<MerchantCategories />} />
        <Route path="knowledge" element={<MerchantKnowledge />} />
        <Route path="promotions" element={<MerchantPromotions />} />
        <Route path="payment-accounts" element={<MerchantPaymentAccounts />} />
        <Route path="bank-sync" element={<MerchantBankSync />} />
        <Route path="operations" element={<MerchantOperationsFeed />} />
        <Route path="telegram" element={<MerchantTelegram />} />
        <Route path="channels" element={<MerchantChannels />} />
        <Route path="customers" element={<MerchantCustomers />} />
        <Route path="customers/:id" element={<MerchantCustomerDetail />} />
        <Route path="settings" element={<MerchantSettings />} />
      </Route>
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/checkout/success" element={<CheckoutSuccess />} />
      <Route path="/checkout/error" element={<CheckoutError />} />
      {/* Legacy: admin merged into super */}
      <Route path="/admin" element={<Navigate to="/super/plans" replace />} />
      <Route path="/admin/*" element={<Navigate to="/super/plans" replace />} />
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
