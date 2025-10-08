import { SECApiDemo } from "@/components/SECApiDemo"
import { TenKFileExplorer } from "@/components/TenKFileExplorer"

function App() {
  const path = window.location.pathname

  if (path === "/originalDemo") {
    return <SECApiDemo />
  }

  return <TenKFileExplorer />
}

export default App
