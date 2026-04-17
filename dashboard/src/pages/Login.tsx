import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-4">
      <div className="w-full max-w-md bg-surface-container-low rounded-xl p-8">
        <h1 className="font-headline text-3xl font-extrabold text-brand-dark tracking-tight mb-2">
          Biosur Eco
        </h1>
        <p className="text-on-surface-variant mb-8">
          Ingresa tus credenciales para acceder al Dashboard.
        </p>

        {error && (
          <div className="mb-4 px-4 py-3 bg-error/10 text-error rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="font-label text-xs uppercase tracking-widest text-on-surface-variant mb-1 block">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-surface-container-highest border-0 border-b-2 border-transparent focus:border-primary focus:ring-0 rounded-t-lg py-3 px-4 text-on-surface placeholder:text-outline transition-all"
              placeholder="usuario@biosur.cl"
            />
          </div>

          <div>
            <label className="font-label text-xs uppercase tracking-widest text-on-surface-variant mb-1 block">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-surface-container-highest border-0 border-b-2 border-transparent focus:border-primary focus:ring-0 rounded-t-lg py-3 px-4 text-on-surface placeholder:text-outline transition-all"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-primary text-on-primary font-bold rounded-lg transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? 'Ingresando…' : 'Iniciar Sesión'}
          </button>
        </form>
      </div>
    </div>
  );
}
