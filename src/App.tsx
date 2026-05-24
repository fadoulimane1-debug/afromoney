import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from '@/components/Layout';
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

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Accueil />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/caisse" element={<CaisseJour />} />
        <Route path="/journal-journee" element={<JourneeSnapshots />} />
        <Route path="/reconciliation" element={<Reconciliation />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/stock" element={<Stock />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/credits" element={<Credits />} />
        <Route path="/reliquats" element={<Reliquats />} />
        <Route path="/journal-caisse" element={<JournalCaisse />} />
        <Route path="/mouvements-coffre" element={<MouvementsCoffre />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/clients/:id" element={<ClientDetail />} />
        <Route path="/cloture" element={<Cloture />} />
        <Route path="/clotures-history" element={<ClosureHistory />} />
        <Route path="/cotation" element={<Cotation />} />
        <Route path="/audit" element={<AuditJournal />} />
        <Route path="/audit-trail" element={<AuditTrail />} />
        <Route path="/parametres" element={<Parametres />} />
        <Route path="/utilisateurs" element={<Utilisateurs />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
