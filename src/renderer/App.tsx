import { useEffect, useState } from 'react';
import WorkspaceScreen from './screens/WorkspaceScreen';
import PegawaiScreen from './screens/PegawaiScreen';
import UploadScreen from './screens/UploadScreen';
import { api } from './lib/api';

type Screen = 'workspace' | 'pegawai' | 'upload';

export default function App() {
  const [screen, setScreen] = useState<Screen>('workspace');
  const [workspacePath, setWorkspacePath] = useState<string | null>(null);

  useEffect(() => {
    api.workspace.get().then(setWorkspacePath);
  }, []);

  return (
    <div className="flex h-full">
      <aside className="w-56 bg-slate-900 text-slate-200 p-4 flex flex-col gap-2">
        <h1 className="text-lg font-bold mb-4">Pajak App</h1>
        <NavBtn active={screen === 'workspace'} onClick={() => setScreen('workspace')}>Workspace</NavBtn>
        <NavBtn active={screen === 'pegawai'} onClick={() => setScreen('pegawai')}>Pegawai</NavBtn>
        <NavBtn active={screen === 'upload'} onClick={() => setScreen('upload')}>Upload SPM</NavBtn>
        <div className="mt-auto text-xs text-slate-500 break-words">
          {workspacePath ?? 'No workspace'}
        </div>
      </aside>
      <main className="flex-1 p-6 overflow-auto">
        {screen === 'workspace' && <WorkspaceScreen onChange={setWorkspacePath} />}
        {screen === 'pegawai' && <PegawaiScreen />}
        {screen === 'upload' && <UploadScreen workspacePath={workspacePath} />}
      </main>
    </div>
  );
}

function NavBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`text-left px-3 py-2 rounded text-sm ${active ? 'bg-slate-700' : 'hover:bg-slate-800'}`}
    >
      {children}
    </button>
  );
}
