import { useTheme } from '../context/ThemeContext'
import Icon from './Icon'

export default function ThemeToggle({ showLabel = false }) {
  const { theme, toggleTheme } = useTheme()
  const next = theme === 'light' ? 'dark' : 'light'
  return (
    <button className="theme-toggle" type="button" onClick={toggleTheme} aria-label={`Switch to ${next} theme`}>
      <Icon name={theme === 'light' ? 'moon' : 'sun'} size={18} />
      {showLabel && <span>Use {next} theme</span>}
    </button>
  )
}

