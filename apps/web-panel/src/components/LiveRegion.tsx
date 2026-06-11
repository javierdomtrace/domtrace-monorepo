/**
 * LiveRegion — aria-live announcer for screen readers.
 * Usage: import { announce } from './LiveRegion' and call announce('message') anywhere.
 */
import { useEffect, useState } from 'react'

let _setMsg: ((msg: string) => void) | null = null

export function announce(message: string) {
  _setMsg?.(message)
}

export function LiveRegion() {
  const [msg, setMsg] = useState('')

  useEffect(() => {
    _setMsg = (m: string) => {
      setMsg('')
      // Small delay ensures screen readers pick up the change
      setTimeout(() => setMsg(m), 100)
    }
    return () => { _setMsg = null }
  }, [])

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-live"
    >
      {msg}
    </div>
  )
}
