interface PixProps {
  mood?: 'idle' | 'happy' | 'panic'
  label?: boolean
}

export function Pix({ mood = 'idle', label = false }: PixProps) {
  return (
    <span className={`pix pix--${mood}`} role="img" aria-label={`PIX, unauthorized geometric organism, ${mood}`}>
      <span className="pix__antenna" />
      <span className="pix__face"><i /><i /></span>
      <span className="pix__feet"><i /><i /></span>
      {label && <b>PIX</b>}
    </span>
  )
}
