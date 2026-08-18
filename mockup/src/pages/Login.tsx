import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Label } from '../components/ui/Label';

const LOGIN_IMAGE = "/55afe285-c494-4ed4-9a32-289c0138bebe.jpg";


export function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (email.trim().length === 0 || password.length === 0) {
      setError('Enter both your member email and password to continue.');
      return;
    }
    setError('');
    setSubmitting(true);
    window.setTimeout(() => {
      setSubmitting(false);
      navigate('/');
    }, 600);
  };

  return (
    <div className="grid min-h-screen w-full grid-cols-1 bg-background lg:grid-cols-2">
      <div className="flex flex-col justify-center px-gutter py-10 lg:px-gutter-lg lg:py-16">
        <div className="mx-auto w-full max-w-md">
          <div className="border-b border-border pb-6">
            <p className="text-base font-semibold tracking-tight text-foreground">
              Bridgewell Institute
            </p>
            <p className="eyebrow mt-1 text-muted-foreground">Member portal</p>
          </div>

          <h1 className="mt-8 text-2xl font-semibold tracking-tight text-foreground lg:text-3xl">
            Sign in
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This portal is private to trained members and staff. If your institution issued your
            account, use your work email address.
          </p>

          <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-5">
            {error ?
            <div
              role="alert"
              className="flex gap-2 rounded-md border border-destructive bg-card p-3 text-sm text-destructive">
              
                <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{error}</p>
              </div> :
            null}

            <div>
              <Label htmlFor="email" className="mb-1.5 block text-sm font-medium">
                Member email
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-invalid={error.length > 0}
                className="min-h-tap border-input" />
              
            </div>

            <div>
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <Label htmlFor="password" className="block text-sm font-medium">
                  Password
                </Label>
                <a
                  href="#reset"
                  className="text-sm font-medium text-primary underline decoration-border-strong underline-offset-4 hover:decoration-primary">
                  
                  Forgot password
                </a>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  aria-invalid={error.length > 0}
                  className="min-h-tap border-input pr-12" />
                
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-pressed={showPassword}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-0 top-0 flex h-tap w-tap items-center justify-center rounded-md text-muted-foreground transition-colors duration-fast ease-standard hover:text-foreground">
                  
                  {showPassword ?
                  <EyeOff aria-hidden="true" className="h-4 w-4" /> :

                  <Eye aria-hidden="true" className="h-4 w-4" />
                  }
                </button>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-md border border-border bg-card p-3">
              <input
                id="shared-device"
                name="shared-device"
                type="checkbox"
                className="mt-0.5 h-5 w-5 shrink-0 rounded-sm border border-input accent-primary" />
              
              <div>
                <Label htmlFor="shared-device" className="block text-sm font-medium">
                  This is a shared device
                </Label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  We will sign you out after 15 minutes of inactivity and skip saving your session.
                </p>
              </div>
            </div>

            <Button type="submit" disabled={submitting} className="min-h-tap w-full">
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <div className="mt-8 border-t border-border pt-6">
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              Access is granted by role. If you have completed training but cannot sign in, contact
              your regional coordinator or{' '}
              <a
                href="#support"
                className="font-medium text-primary underline decoration-border-strong underline-offset-4 hover:decoration-primary">
                
                member support
              </a>
              .
            </p>
          </div>
        </div>
      </div>

      <div className="relative hidden border-l border-border bg-muted lg:block">
        <img
          src={LOGIN_IMAGE}
          alt="Three staff members sitting around a table with notebooks during a training session"
          className="h-full w-full object-cover" />
        
        <figcaption className="absolute inset-x-0 bottom-0 border-t border-border bg-card px-8 py-5">
          <p className="max-w-lg text-sm text-foreground">
            “The work is easier when you are not carrying it alone.”
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Core Practice cohort, Springfield · 2025
          </p>
        </figcaption>
      </div>
    </div>);

}