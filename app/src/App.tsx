import { SECApiDemo } from "@/components/SECApiDemo"
import { TakeHomeLayout } from "@/components/TakeHomeLayout"

function App() {
  const path = window.location.pathname

  if (path === "/takeHome") {
    return <TakeHomeLayout />
  }

  return <SECApiDemo />
}

export default App
