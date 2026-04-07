import { useState } from 'react'
import { Button } from './components/Button'

function App(): JSX.Element {
  const [count, setCount] = useState(0)

  const ipcHandle = (): void => window.electron.ipcRenderer.send('ping')

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-8">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-2xl w-full">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Resume-Agent</h1>
        <p className="text-gray-600 mb-6">
          Welcome to Resume-Agent - your personal resume management and interview tracking application.
        </p>
        
        <div className="flex flex-col gap-4 items-start">
          <div className="flex items-center gap-4">
            <Button onClick={() => setCount((count) => count + 1)}>
              Count is {count}
            </Button>
            <Button variant="secondary" onClick={ipcHandle}>
              Send IPC Ping
            </Button>
          </div>
          
          <p className="text-sm text-gray-500">
            Edit <code className="bg-gray-100 px-1 py-0.5 rounded">src/renderer/src/App.tsx</code> to test HMR
          </p>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-400">
            Powered by Electron + Vite + React + TypeScript + Tailwind CSS
          </p>
        </div>
      </div>
    </div>
  )
}

export default App
