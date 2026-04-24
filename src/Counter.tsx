import { useState } from 'react'

export function Counter() {
  const [count, setCount] = useState(0)

  return (
    <button id="counter" type="button" className="counter" onClick={() => setCount((c) => c + 1)}>
      Count is {count}
    </button>
  )
}
