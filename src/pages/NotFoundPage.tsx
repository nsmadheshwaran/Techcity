import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { EmptyState } from '@/components/ui/States'

export default function NotFoundPage() {
  return (
    <div className="card">
      <EmptyState
        icon={Compass}
        title="Page not found"
        message="The page you are looking for does not exist or has been moved."
        action={
          <Link to="/" className="btn-primary">
            Go to Dashboard
          </Link>
        }
      />
    </div>
  )
}
