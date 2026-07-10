import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./utils/dayjs.config";
import App from "./App";
import { MachineProvider } from "./providers/MachineProvider";
import { AuthProvider } from "./providers/AuthProvider";
import AuthScreen from "./components/AuthScreen/AuthScreen";
import { useAuthMachine } from "./providers/AuthProvider";
import { BrowserRouter } from "react-router-dom";
import { DataProvider } from "./providers/DataProvider";
import LoginLoadingScreen from "./components/shared/LoadingScreens/LoginLoadingScreen";
import LogoutLoadingScreen from "./components/shared/LoadingScreens/LogoutLoadingScreen";
import AuthCheckingScreen from "./components/shared/LoadingScreens/AuthCheckingScreen";

const AppRouter = () => {
  const { authState } = useAuthMachine();

  if (authState?.value === 'checkingAuth') {
    return <AuthCheckingScreen />;
  }

  if (authState?.context?.loading) {
    return <LoginLoadingScreen />;
  }

  if (authState?.context?.loggingOut) {
    return <LogoutLoadingScreen />;
  }

  // FSEC-M1 — cosmetic auth gate: `isAuthenticated` (client-held) only decides
  // whether to render the app shell vs the auth screen. It is not a security
  // boundary — every privileged request is authorized server-side by the JWT.
  return authState?.context.isAuthenticated ? <App /> : <AuthScreen />;
};

const Root = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <DataProvider>
          <MachineProvider>
            <StrictMode>
              <AppRouter />
            </StrictMode>
          </MachineProvider>
        </DataProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

createRoot(document.getElementById("root")!).render(<Root />);