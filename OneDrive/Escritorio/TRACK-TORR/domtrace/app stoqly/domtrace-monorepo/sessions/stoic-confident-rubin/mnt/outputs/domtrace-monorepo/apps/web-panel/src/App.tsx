import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './store/auth'
import { Layout } from './components/Layout'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { PantryPage } from './pages/PantryPage'
import { AlertsPage } from './pages/AlertsPage'
import { ShoppingPage } from './pages/ShoppingPage'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const user = useAuth(s => s.user)
  return user ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<DashboardPage />} />
        <Route path="pantry" element={<PantryPage />} />
        <Route path="alerts" element={<AlertsPage />} />
        <Route path="shopping" element={<ShoppingPage />} />
      </Route>
    </Routes>
  )
}
