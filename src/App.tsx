import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Login } from '@/pages/Login';
import { useAuthContext } from '@/context/AuthContext';
import { Dashboard } from '@/pages/Dashboard';
import { Transactions } from '@/pages/Transactions';
import { Stock } from '@/pages/Stock';
import { Reports } from '@/pages/Reports';
import { Credits } from '@/pages/Credits';
import { CaisseJour } from '@/pages/CaisseJour';
import { Cloture } from '@/pages/Cloture';
import { ClosureHistory } from '@/pages/ClosureHistory';
import { JourneeSnapshots } from '@/pages/JourneeSnapshots';
import { Reconciliation } from '@/pages/Reconciliation';
import { Accueil } from '@/pages/Accueil';
import { AuditJournal } from '@/pages/AuditJournal';
import { Cotation } from '@/pages/Cotation';
import { Parametres } from '@/pages/Parametres';
import { Reliquats } from '@/pages/Reliquats';
import { JournalCaisse } from '@/pages/JournalCaisse';
import { Clients } from '@/pages/Clients';
import { ClientDetail } from '@/pages/ClientDetail';
import { MouvementsCoffre } from '@/pages/MouvementsCoffre';
import { Utilisateurs } from '@/pages/Utilisateurs';
import { AuditTrail } from '@/pages/AuditTrail';

// Synthèse = Dashboard (ou tu peux créer une page Synthèse.tsx séparée)
const Synthese = Dashboard;

function ProtectedLayout() {
  const { isAuthenticated } = useAuthContext();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Layout />;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedLayout />}>
        {/* ═══════════════════════════════════════════════════════════ */}
        {/* PAGES PRINCIPALES */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <Route path="/" element={<Accueil />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/synthese" element={<Synthese />} />
        
        {/* ═══════════════════════════════════════════════════════════ */}
        {/* CAISSE ET CLÔTURE */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <Route path="/caisse" element={<CaisseJour />} />
        <Route path="/cloture" element={<Cloture />} />
        <Route path="/clotures-history" element={<ClosureHistory />} />
        <Route path="/journal-journee" element={<JourneeSnapshots />} />
        
        {/* ═══════════════════════════════════════════════════════════ */}
        {/* OPÉRATIONS */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/reliquats" element={<Reliquats />} />
        <Route path="/mouvements-coffre" element={<MouvementsCoffre />} />
        <Route path="/journal-caisse" element={<JournalCaisse />} />
        
        {/* ═══════════════════════════════════════════════════════════ */}
        {/* VÉRIFICATION */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <Route path="/reconciliation" element={<Reconciliation />} />
        <Route path="/cotation" element={<Cotation />} />
        
        {/* ═══════════════════════════════════════════════════════════ */}
        {/* RAPPORTS */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <Route path="/stock" element={<Stock />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/credits" element={<Credits />} />
        
        {/* ═══════════════════════════════════════════════════════════ */}
        {/* CLIENTS */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <Route path="/clients" element={<Clients />} />
        <Route path="/clients/:id" element={<ClientDetail />} />
        
        {/* ═══════════════════════════════════════════════════════════ */}
        {/* AUDIT */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <Route path="/audit" element={<AuditJournal />} />
        <Route path="/audit-trail" element={<AuditTrail />} />
        
        {/* ═══════════════════════════════════════════════════════════ */}
        {/* CONFIGURATION */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <Route path="/parametres" element={<Parametres />} />
        <Route path="/utilisateurs" element={<Utilisateurs />} />
      </Route>
      
      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
