import React, { useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './store/auth'
import { useA11y } from './store/accessibility'
import { Layout } from './components/Layout'
import { AccessibilityPanel } from './components/AccessibilityPanel'
import { LiveRegion, announce } from './components/LiveRegion'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { PantryPage } from './pages/PantryPage'
import { AlertsPage } from './pages/AlertsPage'
import { ShoppingPage } from './pages/ShoppingPage'
import { SettingsPage } from './pages/SettingsPage'
import { RegisterPage } from './pages/RegisterPage'
import { DinnerPage } from './pages/DinnerPage'
import { ReceivePage } from './pages/ReceivePage'
import { PlansPage } from './pages/PlansPage'
import { CosmeticsPage } from './pages/CosmeticsPage'
import { SupplementsPage } from './pages/SupplementsPage'
import { MedicationsPage } from './pages/MedicationsPage'
import { BabyPage } from './pages/BabyPage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { AcceptInvitePage } from './pages/AcceptInvitePage'
import { AccessibilityPage } from './pages/AccessibilityPage'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const user = useAuth(s => s.user)
  return user ? <>{children}</> : <Navigate to="/login" replace />
}

// Announce page changes to screen readers
const PAGE_TITLES: Record<string, string> = {
  '/':            'Inicio — Stoqly',
  '/pantry':      'Despensa — Stoqly',
  '/alerts':      'Alertas — Stoqly',
  '/shopping':    'Lista de la compra — Stoqly',
  '/dinner':      'Qué cocino — Stoqly',
  '/recibir':     'Recibir compra — Stoqly',
  '/plans':       'Planes — Stoqly',
  '/cosmetics':   'Belleza y cosméticos — Stoqly',
  '/supplements': 'Suplementos — Stoqly',
  '/medications': 'Medicamentos — Stoqly',
  '/baby':        'Bebés — Stoqly',
  '/settings':    'Ajustes — Stoqly',
  '/accesibilidad': 'Declaración de accesibilidad — Stoqly',
}

function RouteAnnouncer() {
  const location = useLocation()
  useEffect(() => {
    const title = PAGE_TITLES[location.pathname] ?? 'Stoqly'
    document.title = title
    announce(`Navegado a: ${title}`)
  }, [location.pathname])
  return null
}

function A11yClasses({ children }: { children: React.ReactNode }) {
  const { highContrast, fontSize, reducedMotion } = useA11y()

  useEffect(() => {
    const html = document.documentElement
    // High contrast
    html.classList.toggle('hc', highContrast)
    // Font size
    html.classList.remove('fs-large', 'fs-xlarge')
    if (fontSize === 'large')  html.classList.add('fs-large')
    if (fontSize === 'xlarge') html.classList.add('fs-xlarge')
    // Reduced motion
    html.classList.toggle('rm', reducedMotion)
  }, [highContrast, fontSize, reducedMotion])

  return <>{children}</>
}

export default function App() {
  return (
    <A11yClasses>
      {/* Skip to main content — first focusable element */}
      <a href="#main-content" className="skip-link">
        Saltar al contenido principal
      </a>

      {/* Screen reader live region */}
      <LiveRegion />

      {/* Route title announcer */}
      <RouteAnnouncer />

      {/* Global accessibility panel (always visible) */}
      <AccessibilityPanel />

      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/registro" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/invite/:token" element={<AcceptInvitePage />} />
        <Route path="/accesibilidad" element={<AccessibilityPage />} />
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<DashboardPage />} />
          <Route path="pantry" element={<PantryPage />} />
          <Route path="alerts" element={<AlertsPage />} />
          <Route path="shopping" element={<ShoppingPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="dinner" element={<DinnerPage />} />
          <Route path="recibir" element={<ReceivePage />} />
          <Route path="plans" element={<PlansPage />} />
          <Route path="cosmetics" element={<CosmeticsPage />} />
          <Route path="supplements" element={<SupplementsPage />} />
          <Route path="medications" element={<MedicationsPage />} />
          <Route path="baby" element={<BabyPage />} />
        </Route>
      </Routes>
    </A11yClasses>
  )
}
