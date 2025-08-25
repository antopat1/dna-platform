// frontend-dapp/src/app/page.tsx
// Importa il tuo componente di test
import ContractTestViem from '../components/ContractTestViem';
import EventFeed from '../components/EventFeed';

export default function Home() {
  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
      <h1 style={{ marginBottom: '30px', fontSize: '2.5em', color: '#0056b3' }}>
        Benvenuto nella Piattaforma DnA
      </h1>
      {/* <EventFeed /> */}
      
      {/* <ContractTestViem /> */}
    </main>
  );
}