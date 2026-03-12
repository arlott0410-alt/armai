import { Suspense, lazy } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'

/** If user lands on / with email-confirm params, send to /auth/confirm so ConfirmPage runs. */
function RootRedirect() {
  const loc = useLocation()
  const hasTokenHash = new URLSearchParams(loc.search).has('token_hash')
  const hasAccessToken = loc.hash.includes('access_token=')
  if (hasTokenHash || hasAccessToken) {
    const to = `/auth/confirm${loc.search}${loc.hash}`
    return <Navigate to={to} replace />
  }
  return <Navigate to="/login" replace />
}

const Login = lazy(() => import('./pages/Login'))
const SignupPage = lazy(() => import('./pages/SignupPage'))
const ConfirmPage = lazy(() => import('./pages/ConfirmPage'))
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
const SuperSettings = lazy(() => import('./pages/super/SuperSettings'))
const MerchantDashboard = lazy(() => import('./pages/merchant/MerchantDashboard'))
const MerchantOrders = lazy(() => import('./pages/merchant/MerchantOrders'))
const MerchantOrderDetail = lazy(() => import('./pages/merchant/MerchantOrderDetail'))
const ProductsAndCategoriesPage = lazy(() => import('./pages/merchant/ProductsAndCategoriesPage'))
const PaymentConfigPage = lazy(() => import('./pages/merchant/PaymentConfigPage'))
const ChannelsPage = lazy(() => import('./pages/merchant/ChannelsPage'))
const WhatsAppCallbackPage = lazy(() => import('./pages/merchant/WhatsAppCallbackPage'))
const AiConfigPage = lazy(() => import('./pages/merchant/AiConfigPage'))
const GeneralSettingsPage = lazy(() => import('./pages/merchant/GeneralSettingsPage'))
const MerchantCustomers = lazy(() => import('./pages/merchant/MerchantCustomers'))
const MerchantCustomerDetail = lazy(() => import('./pages/merchant/MerchantCustomerDetail'))
const MerchantPromotions = lazy(() => import('./pages/merchant/MerchantPromotions'))
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
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/auth/confirm" element={<ConfirmPage />} />
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
          <Route path="settings" element={<SuperSettings />} />
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
          <Route path="products" element={<ProductsAndCategoriesPage />} />
          <Route path="payment-config" element={<PaymentConfigPage />} />
          <Route path="channels" element={<ChannelsPage />} />
          <Route path="channels/whatsapp/callback" element={<WhatsAppCallbackPage />} />
          <Route path="ai-config" element={<AiConfigPage />} />
          <Route path="general-settings" element={<GeneralSettingsPage />} />
          <Route path="customers" element={<MerchantCustomers />} />
          <Route path="customers/:id" element={<MerchantCustomerDetail />} />
          <Route path="categories" element={<Navigate to="/merchant/products" replace />} />
          <Route path="knowledge" element={<Navigate to="/merchant/ai-config" replace />} />
          <Route path="promotions" element={<MerchantPromotions />} />
          <Route
            path="payment-accounts"
            element={<Navigate to="/merchant/payment-config" replace />}
          />
          <Route path="bank-sync" element={<Navigate to="/merchant/payment-config" replace />} />
          <Route path="operations" element={<MerchantOperationsFeed />} />
          <Route path="telegram" element={<Navigate to="/merchant/channels" replace />} />
          <Route path="settings" element={<Navigate to="/merchant/general-settings" replace />} />
        </Route>
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/checkout/success" element={<CheckoutSuccess />} />
        <Route path="/checkout/error" element={<CheckoutError />} />
        {/* Legacy: admin merged into super */}
        <Route path="/admin" element={<Navigate to="/super/plans" replace />} />
        <Route path="/admin/*" element={<Navigate to="/super/plans" replace />} />
        <Route path="/" element={<RootRedirect />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  )
}
