import { createContext, useContext, useState, type ReactNode } from "react";
import { AUTH_TOKEN_KEY, signin as signinRequest } from "./api";

type AuthContextValue = {
  token: string | null;
  isAuthenticated: boolean;
  signin: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(AUTH_TOKEN_KEY),
  );

  const signin = async (email: string, password: string) => {
    const response = await signinRequest({ email, password });
    if (!response.data) throw new Error("The server did not return a token");
    localStorage.setItem(AUTH_TOKEN_KEY, response.data);
    setToken(response.data);
  };

  const logout = () => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    setToken(null);
  };

  return (
    <AuthContext.Provider
      value={{ token, isAuthenticated: Boolean(token), signin, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error("useAuth must be used inside AuthProvider");
  return auth;
}
