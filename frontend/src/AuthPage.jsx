
import { useState } from "react";
import "./AuthPage.css";

function AuthPage({ onLogin, onRegister }) {
  const [isRegister, setIsRegister] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [theme, setTheme] = useState(
    () => localStorage.getItem("collabcode-auth-theme") || "dark"
  );

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("collabcode-auth-theme", newTheme);
  };

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });

    setError("");
    setSuccess("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (isRegister && form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      if (isRegister) {
        await onRegister({
          name: form.name,
          email: form.email,
          password: form.password,
        });

        setSuccess("Account created successfully!");

        setForm({
          name: "",
          email: "",
          password: "",
          confirmPassword: "",
        });

        setShowPassword(false);
      } else {
        await onLogin({
          email: form.email,
          password: form.password,
        });
      }
    } catch (err) {
      setError(err.message || "Something went wrong.");
    }
  };

  const switchAuthMode = (registerMode) => {
    setIsRegister(registerMode);
    setError("");
    setSuccess("");
    setShowPassword(false);
  };

  return (
    <div className={`auth-page ${theme}-theme`}>
      <div className="auth-background-glow glow-one"></div>
      <div className="auth-background-glow glow-two"></div>

      <nav className="auth-navbar">
        <div className="auth-brand">
          <div className="brand-icon">{"</>"}</div>
          <span>
            Collab<span className="brand-highlight">Code</span>
          </span>
        </div>

        <div className="auth-nav-actions">
          <div className="nav-status">
            <span className="status-dot"></span>
            Built for developers
          </div>

          <button
            type="button"
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={`Switch to ${
              theme === "dark" ? "light" : "dark"
            } theme`}
          >
            <span>{theme === "dark" ? "☀️" : "🌙"}</span>
          </button>
        </div>
      </nav>

      <main className="auth-main">
        <section className="auth-intro">
          <div className="intro-badge">
            <span>✦</span> YOUR CODE. YOUR TEAM. ONE SPACE.
          </div>

          <h1>
            Build something
            <br />
            <span>amazing together.</span>
          </h1>

          <p className="intro-description">
            A collaborative coding workspace where ideas turn into
            code. Write, run and collaborate with your team in real time.
          </p>

          <div className="feature-list">
            <div className="feature-item">
              <span className="feature-icon">&lt;/&gt;</span>
              <div>
                <h3>Powerful code editor</h3>
                <p>
                  Write code with a familiar developer experience.
                </p>
              </div>
            </div>

            <div className="feature-item">
              <span className="feature-icon">⌘</span>
              <div>
                <h3>Real-time collaboration</h3>
                <p>Work together in the same coding session.</p>
              </div>
            </div>

            <div className="feature-item">
              <span className="feature-icon">▶</span>
              <div>
                <h3>Code and execute</h3>
                <p>Run your programs directly in your workspace.</p>
              </div>
            </div>
          </div>

          <div className="auth-code-preview">
            <div className="preview-topbar">
              <div className="preview-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <span>Welcome.java</span>
              <span className="preview-language">JAVA</span>
            </div>

            <pre>
              <span className="code-purple">public class</span>{" "}
              <span className="code-blue">Welcome</span>
              {" {\n  "}
              <span className="code-purple">public static void</span>{" "}
              <span className="code-yellow">main</span>
              {"(String[] args) {\n    "}
              <span className="code-blue">System.out.println</span>
              {"("}
              <span className="code-green">"Hello, developer!"</span>
              {");\n  }\n}"}
            </pre>
          </div>
        </section>

        <section className="auth-card">
          <div className="auth-card-heading">
            <div className="card-symbol">
              {isRegister ? "✦" : "↗"}
            </div>

            <h2>
              {isRegister ? "Create your account" : "Welcome back"}
            </h2>

            <p>
              {isRegister
                ? "Start building something great today."
                : "Sign in to continue to your workspace."}
            </p>
          </div>

          <div className="auth-tabs">
            <button
              type="button"
              className={!isRegister ? "active" : ""}
              onClick={() => switchAuthMode(false)}
            >
              Sign in
            </button>

            <button
              type="button"
              className={isRegister ? "active" : ""}
              onClick={() => switchAuthMode(true)}
            >
              Create account
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            {isRegister && (
              <div className="auth-field">
                <label htmlFor="name">Full name</label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="Enter your name"
                  value={form.name}
                  onChange={handleChange}
                  autoComplete="name"
                  required
                />
              </div>
            )}

            <div className="auth-field">
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={handleChange}
                autoComplete="email"
                required
              />
            </div>

            <div className="auth-field">
              <label htmlFor="password">Password</label>

              <div className="password-wrapper">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={handleChange}
                  autoComplete={
                    isRegister ? "new-password" : "current-password"
                  }
                  required
                  minLength={8}
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>

              {isRegister && (
                <span className="field-hint">
                  Use at least 8 characters.
                </span>
              )}
            </div>

            {isRegister && (
              <div className="auth-field">
                <label htmlFor="confirmPassword">
                  Confirm password
                </label>

                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  placeholder="Re-enter your password"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  autoComplete="new-password"
                  required
                  minLength={8}
                />
              </div>
            )}

            {error && (
              <div className="auth-error" role="alert">
                {error}
              </div>
            )}

            {success && (
              <div className="auth-success" role="status">
                <span>✓</span>
                {success}
              </div>
            )}

            <button type="submit" className="auth-submit">
              {isRegister ? "Create account" : "Sign in"}
              <span>→</span>
            </button>
          </form>

          <div className="auth-switch">
            {isRegister
              ? "Already have an account?"
              : "New to CollabCode?"}

            <button
              type="button"
              onClick={() => switchAuthMode(!isRegister)}
            >
              {isRegister ? "Sign in" : "Create account"}
            </button>
          </div>

          <div className="auth-security">
            <span>▣</span>
            Your workspace starts here.
          </div>
        </section>
      </main>

      <footer className="auth-footer">
        <span>© 2026 CollabCode</span>
        <span>
          Made for people who love to code <span>♥</span>
        </span>
      </footer>
    </div>
  );
}

export default AuthPage;