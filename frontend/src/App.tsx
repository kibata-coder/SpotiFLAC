import { SearchPanel } from './components/SearchPanel'; 

function App() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-zinc-950 text-white font-sans selection:bg-green-500/30">
      <main className="flex flex-1 items-center justify-center p-6 overflow-y-auto">
        <SearchPanel />
      </main>
    </div>
  );
}

export default App;
