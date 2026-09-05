import { NavLink, Outlet } from 'react-router'

import PageHeader from '../../components/ui/PageHeader'

const tabs = [
  ['general', 'General'],
  ['company', 'Company'],
  ['branding', 'Branding'],
  ['navigation', 'Navigation'],
  ['landing', 'Landing page'],
  ['products', 'Products'],
  ['integrations', 'Integrations'],
  ['contact', 'Contact'],
  ['seo', 'SEO'],
  ['media', 'Media'],
]

export default function WebsiteLayout() {
  return (
    <div className="page website-page">
      <PageHeader eyebrow="Public website CMS" title="Website" description="Manage public content, publishing, relationships, media, navigation, branding, and metadata without a frontend deployment." />
      <nav className="website-tabs" aria-label="Website management">
        {tabs.map(([path, label]) => <NavLink key={path} to={path} className={({ isActive }) => isActive ? 'website-tabs__link website-tabs__link--active' : 'website-tabs__link'}>{label}</NavLink>)}
      </nav>
      <Outlet />
    </div>
  )
}

