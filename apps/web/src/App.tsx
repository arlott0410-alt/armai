import { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'

const Login = lazy(() => import('./pages/Login'))
const Pricing = lazy(() => import('./pages/Pricing'))
const CheckoutSuccess = lazy(() => import('./pages/CheckoutSuccess'))
const CheckoutError = lazy(() => import('./pages/CheckoutError'))
const SuperLayout = lazy(() => import('./layouts/SuperLayout'))
const MerchantLayout = lazy(() => import('./layouts/MerchantLayout'))
const SuperDashboard = lazy(() => import('./pages/super/SuperDashboard'))
const SuperMerchants = lazy(() => import('./pages/super/SuperMerchants'))
const SuperMerchantDetail = lazy(() => import('./pages/super/SuperMerchantDetail'))
const SuperBilling = lazy(() => import('./pages/super/SuperBilling'))
const SuperSupport = lazy(() => import('./pages/super/SuperSupport'))
const SuperAudit = lazy(() => import('./pages/super/SuperAudit'))
const SuperPlans = lazy(() => import('./pages/super/SuperPlans'))
const MerchantDashboard = lazy(() => import('./pages/merchant/MerchantDashboard'))
const MerchantOrders = lazy(() => import('./pages/merchant/MerchantOrders'))
const MerchantBankSync = lazy(() => import('./pages/merchant/MerchantBankSync'))
const MerchantSettings = lazy(() => import('./pages/merchant/MerchantSettings'))
const MerchantProducts = lazy(() => import('./pages/merchant/MerchantProducts'))
const MerchantCategories = lazy(() => import('./pages/merchant/MerchantCategories'))
const MerchantKnowledge = lazy(() => import('./pages/merchant/MerchantKnowledge'))
const MerchantPromotions = lazy(() => import('./pages/merchant/MerchantPromotions'))
const MerchantPaymentAccounts = lazy(() => import('./pages/merchant/MerchantPaymentAccounts'))
const MerchantOrderDetail = lazy(() => import('./pages/merchant/MerchantOrderDetail'))
const MerchantTelegram = lazy(() => import('./pages/merchant/MerchantTelegram'))
const MerchantChannels = lazy(() => import('./pages/merchant/MerchantChannels'))
const MerchantCustomers = lazy(() => import('./pages/merchant/MerchantCustomers'))
const MerchantCustomerDetail = lazy(() => import('./pages/merchant/MerchantCustomerDetail'))
const MerchantOperationsFeed = lazy(() => import('./pages/merchant/MerchantOperationsFeed'))

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

function PageFallback() {
  return (
    <div
      className="flex min-h-[60vh] items-center justify-center bg-[var(--armai-bg)]"
      role="status"
      aria-live="polite"
    >
      <div
        className="h-8 w-48 rounded animate-pulse bg-[var(--armai-surface-elevated)]"
        aria-hidden
      />
      <span className="sr-only">Loading</span>
    </div>
  )
}

export default function App() {
  return (
    <Suspense fallback={<PageFallback />}>
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
    </Suspense>
  )
}
