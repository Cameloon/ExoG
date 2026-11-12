import type { ReactNode } from "react";
import { createElement } from "react";
export const ClerkProvider = ({ children }: { children: ReactNode }) => children;
const auth = { getToken: async () => "synthetic-test-token", isLoaded: true };
export const useAuth = () => auth;
const authenticateWithRedirect = async (params: unknown) => {
  if (localStorage.getItem("test-oauth-fail")) throw new Error("Test connection failure");
  localStorage.setItem("test-oauth-request", JSON.stringify(params));
};
export const useSignIn = () => ({ isLoaded: true, signIn: { authenticateWithRedirect } });
export const useSignUp = () => ({ isLoaded: true, signUp: { authenticateWithRedirect } });
export const AuthenticateWithRedirectCallback = () => createElement("div", { "data-testid": "clerk-callback" });

export const useUser = () => ({ isLoaded: true, user: { id: "user_test", primaryEmailAddress: { emailAddress: "test@example.test" } } });
