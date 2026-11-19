import { RetailCollectionPage, collectionMetadata, type CollectionProps } from '@/components/seo/RetailCollectionPage'
export const revalidate = 300
export const generateMetadata = (props: CollectionProps) => collectionMetadata('makes', props)
export default function Page(props: CollectionProps) { return <RetailCollectionPage {...props} kind="makes" /> }
