import { Link } from 'react-router'

export default function NotFoundPage() {
  return <main className="not-found"><div className="brand__mark">A</div><span>404</span><h1>Page not found</h1><p>The address may be incorrect or the page may have moved.</p><Link className="button button--primary button--medium" to="/">Return to Asanlink Central</Link></main>
}

