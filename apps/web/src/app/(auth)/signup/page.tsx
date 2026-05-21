// /signup → redirect to the multi-step register wizard
import { redirect } from 'next/navigation'

export default function SignupRedirectPage() {
  redirect('/register')
}
