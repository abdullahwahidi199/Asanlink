import ConfigEditor from './ConfigEditor'
import { configDefinitions, resourceDefinitions } from './definitions'
import ResourceManager from './ResourceManager'

const Stack = ({ children }) => <div className="website-stack">{children}</div>

export function GeneralWebsitePage() {
  return <Stack><ConfigEditor definition={configDefinitions.settings} /><ConfigEditor definition={configDefinitions.footer} /></Stack>
}

export function CompanyWebsitePage() {
  return <Stack><ConfigEditor definition={configDefinitions.company} /></Stack>
}

export function BrandingWebsitePage() {
  return <Stack><ConfigEditor definition={configDefinitions.branding} /></Stack>
}

export function NavigationWebsitePage() {
  return <Stack><ResourceManager definition={resourceDefinitions.menus} /><ResourceManager definition={resourceDefinitions.navigationItems} /></Stack>
}

export function LandingContentWebsitePage() {
  return <Stack><ResourceManager definition={resourceDefinitions.sections} /><ResourceManager definition={resourceDefinitions.features} /><ResourceManager definition={resourceDefinitions.ctas} /></Stack>
}

export function ProductsWebsitePage() {
  return <Stack><ResourceManager definition={resourceDefinitions.categories} /><ResourceManager definition={resourceDefinitions.products} /><ResourceManager definition={resourceDefinitions.productFeatures} /><ResourceManager definition={resourceDefinitions.productMedia} /></Stack>
}

export function IntegrationsWebsitePage() {
  return <Stack><ResourceManager definition={resourceDefinitions.integrations} /></Stack>
}

export function ContactWebsitePage() {
  return <Stack><ConfigEditor definition={configDefinitions.contact} /><ResourceManager definition={resourceDefinitions.contactChannels} /></Stack>
}

export function SEOWebsitePage() {
  return <Stack><ConfigEditor definition={configDefinitions.seo} /></Stack>
}

export function MediaWebsitePage() {
  return <Stack><ResourceManager definition={resourceDefinitions.media} /></Stack>
}
