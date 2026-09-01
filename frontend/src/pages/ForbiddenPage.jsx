import { useNavigate } from 'react-router'

import { Button } from '../components/ui'

export default function ForbiddenPage() {
  const navigate = useNavigate()
  return <div className="standalone-state"><span>403</span><h1>Access not granted</h1><p>Your account is authenticated, but your role does not include permission for this page.</p><div><Button onClick={() => navigate('/')}>Go to my workspace</Button><Button variant="secondary" onClick={() => navigate(-1)}>Go back</Button></div></div>
}

