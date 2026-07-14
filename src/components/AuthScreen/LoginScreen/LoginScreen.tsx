import React from "react";
import {
  Box,
  Button,
  Typography,
  Paper,
  Stack,
  useMediaQuery,
  useTheme,
  Divider,
  TextField,
  FormControl,
  InputLabel,
  OutlinedInput,
  InputAdornment,
  IconButton,
  Card,
  CardContent,
} from "@mui/material";
import { Visibility, VisibilityOff, LocalHospital, Person } from "@mui/icons-material";
import { useMachines } from "#/providers/MachineProvider";
import Logo from "#/assets/favicon.svg";
import { useAuthMachine } from "#/providers/AuthProvider";
import "./LoginScreen.css";

function LoginScreen() {
  const { uiState, uiSend } = useMachines();
  const { authState, authSend } = useAuthMachine();

  const uiContext = uiState?.context || {};
  const authContext = authState?.context || {};
  const authResponse = authContext.authResponse || null;

  const formContext = uiContext.toggleStates || {};
  const showPassword = formContext["showPassword"] ?? false;
  
  // Check if user is actually authenticated based on auth machine state, not just token presence
  const isSuccess = authContext.isAuthenticated && authState?.value === 'authenticated';
  
  const isVerificationSuccess = authContext.verificationStatus === 'success';
  const isVerificationError = authContext.verificationStatus === 'error';

  const isMobile = useMediaQuery(useTheme().breakpoints.down("sm"));

  const handleMouseDownPassword = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (authContext.loading || authContext.hasErrorsOrEmpty) {
      return;
    }
    authSend({ type: "SUBMIT" });
  };

  return (
      <Box className="auth-container">
        <Paper
          elevation={12}
          className={`auth-paper ${isMobile ? 'auth-paper--mobile' : ''}`}
        >
          {!isMobile && (
            <Box className="auth-left-section">
              <Box display="flex" alignItems="center" justifyContent="center" mb={3}>
                <img
                  src={Logo}
                  alt="MediBook Logo"
                  style={{ width: '40px', height: '40px', marginRight: '12px' }}
                />
                <Typography variant="h3" className="auth-title" style={{ margin: 0 }}>
                  MediBook
                </Typography>
              </Box>
              <Typography variant="h6" color="text.secondary" className="auth-subtitle">
                Sistema de Gestión de Turnos Médicos
              </Typography>
              <Typography variant="body1" color="text.secondary" className="auth-description">
                Inicia sesión para acceder a tu cuenta y gestionar tus citas médicas de manera eficiente.
              </Typography>
              
              <Box className="auth-cards-container">
                <Card className="auth-role-card">
                  <LocalHospital className="auth-role-icon auth-role-icon--doctor" />
                  <Typography variant="caption" display="block" className="auth-role-text--doctor">
                    Para Médicos
                  </Typography>
                </Card>
                <Card className="auth-role-card">
                  <Person className="auth-role-icon auth-role-icon--patient" />
                  <Typography variant="caption" display="block" className="auth-role-text--patient">
                    Para Pacientes
                  </Typography>
                </Card>
              </Box>
            </Box>
          )}

          {!isMobile && <Divider orientation="vertical" flexItem className="auth-divider" />}

        <Box className="auth-right-section">
          {isMobile && (
            <Box className="auth-mobile-header">
              <Box display="flex" alignItems="center" justifyContent="center" mb={2}>
                <img
                  src={Logo}
                  alt="MediBook Logo"
                  style={{ width: '30px', height: '30px', marginRight: '8px' }}
                />
                <Typography variant="h4" className="auth-mobile-title" style={{ margin: 0 }}>
                  MediBook
                </Typography>
              </Box>
            </Box>
          )}
          
          {isSuccess ? (
            <Box className="auth-success-container">
              <Typography variant="h4" className="auth-success-emoji">🎉</Typography>
              <Typography variant="h5" color="success.main" className="auth-success-title">
                ¡Bienvenido de vuelta!
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Inicio de sesión exitoso
              </Typography>
            </Box>
          ) : (
            <Card elevation={0} sx={{ backgroundColor: 'transparent' }}>
              <CardContent sx={{ p: 0 }}>
                <Typography
                  variant="h4"
                  className="auth-form-title"
                >
                  Iniciar Sesión
                </Typography>

                <Box component="form" onSubmit={handleSubmit} style={{ marginTop: '20px' }}>
                  <Stack className="auth-form-stack">
                  <TextField
                    label="Correo Electrónico"
                    name="email"
                    type="email"
                    fullWidth
                    required
                    value={authContext.formValues.email || ""}
                    onChange={(e) => authSend({ type: "UPDATE_FORM", key: "email", value: e.target.value })}
                    error={!!authContext.formErrors?.email}
                    helperText={authContext.formErrors?.email || " "}
                    className="auth-field"
                    autoComplete="email"
                  />

                  <FormControl 
                    variant="outlined" 
                    fullWidth 
                    required
                    className="auth-field"
                  >
                    <InputLabel htmlFor="outlined-adornment-password">Contraseña</InputLabel>
                    <OutlinedInput
                      id="outlined-adornment-password"
                      type={showPassword ? 'text' : 'password'}
                      value={authContext.formValues.password || ""}
                      onChange={(e) => authSend({ type: "UPDATE_FORM", key: "password", value: e.target.value })}
                      error={!!authContext.formErrors?.password}
                      className="auth-password-field"
                      autoComplete="current-password"
                      endAdornment={
                        <InputAdornment position="end">
                          <IconButton
                            aria-label={showPassword ? 'ocultar contraseña' : 'mostrar contraseña'}
                            onClick={() => uiSend({ type: "TOGGLE", key: "showPassword"})}
                            onMouseDown={handleMouseDownPassword}
                            edge="end"
                          >
                            {showPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      }
                      label="Contraseña"
                    />
                    <Typography 
                      variant="caption" 
                      color={authContext.formErrors?.password ? "error" : "transparent"} 
                      className="auth-password-error"
                    >
                      {authContext.formErrors?.password || " "}
                    </Typography>
                  </FormControl>

                  <Button
                    type="submit"
                    variant="contained"
                    fullWidth
                    size="large"
                    disabled={authContext.hasErrorsOrEmpty || authContext.loading}
                    className="auth-submit-button"
                  >
                    {authContext.loading ? "Iniciando sesión..." : "Iniciar Sesión"}
                  </Button>

                  <Box className="auth-toggle-container">
                    <Typography variant="body2" color="text.secondary">
                      ¿No tienes cuenta?{" "}
                      <Button
                        variant="text"
                        onClick={() => authSend({ type: "TOGGLE_MODE", mode: "register" })}
                        className="auth-toggle-button"
                      >
                        Regístrate aquí
                      </Button>
                    </Typography>
                  </Box>

                  {((authResponse && 'error' in authResponse) || isVerificationError) && (
                    <Box className="auth-error-box">
                      <Typography variant="body2" color="error" className="auth-message-text">
                        {isVerificationError 
                          ? (authContext.verificationMessage || "Error en la verificación") 
                          : (authResponse?.error || (authResponse && 'message' in authResponse ? authResponse.message : 'Error en el inicio de sesión'))}
                      </Typography>
                    </Box>
                  )}

                  {((authResponse && 'message' in authResponse && !('error' in authResponse)) || isVerificationSuccess) && (
                    <Box className="auth-success-box">
                      <Typography variant="body2" color="success.main" className="auth-message-text">
                        {isVerificationSuccess 
                          ? (authContext.verificationMessage || "Cuenta verificada correctamente")
                          : (authResponse && 'message' in authResponse ? authResponse.message : '')}
                      </Typography>
                    </Box>
                  )}
                </Stack>
                </Box>
              </CardContent>
            </Card>
          )}
        </Box>
      </Paper>
    </Box>
  );
};

export default LoginScreen;