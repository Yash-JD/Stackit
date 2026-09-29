import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { signup } from "../api";
import { useAuth } from "../auth";
import { type ReactNode } from "react";

export function SigninPage() {
  const { isAuthenticated, signin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isAuthenticated) return <Navigate to="/board/product-launch" replace />;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      await signin(email, password);
      const destination = location.state?.from ?? "/board/product-launch";
      navigate(destination, { replace: true });
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to sign in");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to continue building with your workspace."
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            autoComplete="email"
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            autoComplete="current-password"
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button className="auth-submit" disabled={isSubmitting}>
          {isSubmitting ? "Signing in..." : "Sign in"}
        </button>
        <p className="auth-switch">
          New to Stackit? <Link to="/signup">Create an account</Link>
        </p>
      </form>
    </AuthLayout>
  );
}

export function SignupPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: "",
    password: "",
    profile: "",
    description: "",
  });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isAuthenticated) return <Navigate to="/board/product-launch" replace />;

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      await signup(form);
      navigate("/signin", {
        replace: true,
        state: { message: "Account created. Sign in to continue." },
      });
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Unable to create account",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Create your workspace"
      subtitle="Start turning ideas into clear, useful work."
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          Email
          <input
            type="email"
            value={form.email}
            onChange={(event) => updateField("email", event.target.value)}
            required
            autoComplete="email"
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={form.password}
            onChange={(event) => updateField("password", event.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
          />
        </label>
        <label>
          Profile photo URL <span>(optional)</span>
          <input
            type="url"
            value={form.profile}
            onChange={(event) => updateField("profile", event.target.value)}
          />
        </label>
        <label>
          Short description
          <input
            value={form.description}
            onChange={(event) => updateField("description", event.target.value)}
            required
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button className="auth-submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating account..." : "Create account"}
        </button>
        <p className="auth-switch">
          Already have an account? <Link to="/signin">Sign in</Link>
        </p>
      </form>
    </AuthLayout>
  );
}

function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <main className="auth-page">
      <div className="auth-decoration">
        <span className="auth-orbit orbit-one" />
        <span className="auth-orbit orbit-two" />
        <span className="auth-orbit orbit-three" />
      </div>
      <section className="auth-card">
        <div className="auth-brand">
          ✦ <span>stackit</span>
        </div>
        <p className="auth-kicker">PRODUCT OPERATIONS</p>
        <h1>{title}</h1>
        <p className="auth-subtitle">{subtitle}</p>
        {children}
      </section>
    </main>
  );
}
