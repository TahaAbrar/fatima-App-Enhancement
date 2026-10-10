import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute, PublicOnlyRoute, RoleRoute } from './components/ProtectedRoute'
import { Toaster } from './toast'
import LoginPage from './pages/LoginPage'
import Dashboard from './pages/Dashboard'
import AccountantDashboard from './pages/AccountantDashboard'
import CustomerDashboard from './pages/CustomerDashboard'
import UnitDashboard from './pages/UnitDashboard'

export default function App() {
  return (
    <BrowserRouter>
      <Toaster />
      <Routes>
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>

        <Route element={<RoleRoute allow={['Administrator']} />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/customers" element={<Dashboard />} />
          <Route path="/customers/:slug" element={<Dashboard />} />
          <Route path="/credit" element={<Dashboard />} />
          <Route path="/debit" element={<Dashboard />} />
          <Route path="/cashbook" element={<Dashboard />} />
          <Route path="/transactions" element={<Dashboard />} />
          <Route path="/reports" element={<Dashboard />} />
          <Route path="/reports/item/:itemId" element={<Dashboard />} />
          <Route path="/chart-of-accounts" element={<Dashboard />} />
          <Route path="/chart-of-accounts/account/:accid" element={<Dashboard />} />
          <Route path="/unit" element={<Dashboard />} />
        </Route>

        <Route element={<RoleRoute allow={['Accountant']} />}>
          <Route path="/accountant/dashboard" element={<AccountantDashboard />} />
          <Route path="/accountant/customers" element={<AccountantDashboard />} />
          <Route path="/accountant/customers/:slug" element={<AccountantDashboard />} />
          <Route path="/accountant/credit" element={<AccountantDashboard />} />
          <Route path="/accountant/debit" element={<AccountantDashboard />} />
          <Route path="/accountant/cashbook" element={<AccountantDashboard />} />
          <Route path="/accountant/transactions" element={<AccountantDashboard />} />
          <Route path="/accountant/reports" element={<AccountantDashboard />} />
          <Route path="/accountant/reports/item/:itemId" element={<AccountantDashboard />} />
          <Route path="/accountant/chart-of-accounts" element={<AccountantDashboard />} />
          <Route path="/accountant/chart-of-accounts/account/:accid" element={<AccountantDashboard />} />
        </Route>

        <Route element={<RoleRoute allow={['Customer']} />}>
          <Route path="/customer/dashboard" element={<CustomerDashboard />} />
          <Route path="/customer/transactions" element={<CustomerDashboard />} />
          <Route path="/customer/groups" element={<CustomerDashboard />} />
          <Route path="/customer/groups/:groupId" element={<CustomerDashboard />} />
        </Route>

        <Route element={<RoleRoute allow={['Unit']} />}>
          <Route path="/unit/dashboard" element={<UnitDashboard />} />
          <Route path="/unit/pts" element={<Navigate to="/unit/dashboard" replace />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Navigate to="/login" replace />} />
        </Route>

        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
