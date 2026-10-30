import { useEffect, useState } from "react"

import { ForecastPanel } from "@/components/ForecastPanel"
import { Hero } from "@/components/Hero"
import { loadGpr, type Gpr } from "@/lib/api"

export function App() {
  const [gpr, setGpr] = useState<Gpr>()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    loadGpr().then(setGpr, (error) => {
      console.error(error)
      setFailed(true)
    })
  }, [])

  return (
    <main>
      <Hero today={gpr?.today} failed={failed} />
      {gpr && (
        <div className="px-4 pb-14">
          <ForecastPanel forecast={gpr.forecast} />
        </div>
      )}
    </main>
  )
}
