import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import cheeseHero from '@/assets/cheese-hero.jpg';
import cheeseLogo from '@/assets/cheese-logo.png';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('marie@fromagerie.com');
  const [password, setPassword] = useState('password');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const success = await login(email, password);
      if (!success) setError('Invalid credentials. Try: marie@fromagerie.com, jean@fromagerie.com, or sophie@fromagerie.com');
    } catch (err: any) {
      setError(err.message || 'Failed to connect. Please check that the server is running.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left — hero image */}
      <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center bg-primary/5">
        <img src={cheeseHero} alt="Artisanal cheese" className="absolute inset-0 w-full h-full object-cover opacity-80" />
        <div className="absolute inset-0 bg-gradient-to-t from-primary/60 to-transparent" />
        <div className="relative z-10 text-center px-12">
          <h2 className="text-4xl font-display font-bold text-primary-foreground mb-4">Fromagerie</h2>
          <p className="text-lg text-primary-foreground/80">Cheese Factory Management System</p>
        </div>
      </div>

      {/* Right — login form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <Card className="w-full max-w-md shadow-elevated">
          <CardHeader className="text-center space-y-2">
            <div className="flex justify-center mb-2">
              <img src={cheeseLogo} alt="Logo" className="h-16 w-16" />
            </div>
            <CardTitle className="text-2xl font-display">Welcome Back</CardTitle>
            <p className="text-sm text-muted-foreground">Sign in to manage your fromagerie</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Password</Label>
                <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Signing in…' : 'Sign In'}
              </Button>
              <div className="text-xs text-muted-foreground text-center space-y-1 pt-2">
                <p className="font-medium">Demo accounts:</p>
                <p>marie@fromagerie.com (Admin)</p>
                <p>jean@fromagerie.com (Supervisor)</p>
                <p>sophie@fromagerie.com (Operator)</p>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
