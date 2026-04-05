import { useState } from 'react'
import { PdfViewer } from './pdf/PdfViewer'
import type { AppView } from './types'

export default function App() {
  const [view, setView] = useState<AppView>('bookshelf')
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null)

  const handleFileOpen = async (file: File) => {
    const buffer = await file.arrayBuffer()
    setPdfData(buffer)
    setView('reader')
  }

  if (view === 'bookshelf') {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <label className="cursor-pointer px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          Open PDF
          <input
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) handleFileOpen(file)
            }}
          />
        </label>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col">
      <div className="flex-1">
        {pdfData && (
          <PdfViewer
            fileData={pdfData}
            onTextSelect={(text, anchor) => console.log('Selected:', text, anchor)}
          />
        )}
      </div>
    </div>
  )
}
