import { AuthService } from "../../service/auth-service.service";
import type { AuthMachineContext } from "../../machines/authMachine";

/**
 * Utility functions for authMachine service calls
 */

export interface AuthSubmitParams {
  context: AuthMachineContext;
}

export interface CheckAuthResult {
  authData: any;
  isAuthenticated: boolean;
}

export interface LogoutResult {
  success: boolean;
}

export const checkStoredAuth = async (): Promise<CheckAuthResult> => {
  try {
    const authData = await AuthService.refreshToken();

    if (!authData?.accessToken) {
      return {
        authData: null,
        isAuthenticated: false
      };
    }

    return {
      authData,
      isAuthenticated: true
    };
  } catch (error) {
    console.warn('Auth bootstrap via refresh-token failed:', error);
    return {
      authData: null,
      isAuthenticated: false
    };
  }
};

/**
 * Handle authentication submission (login or register)
 */
export const submitAuthentication = async ({ context }: AuthSubmitParams) => {
  if (context.mode === "login") {
    return await AuthService.signIn({
      email: context.formValues.email,
      password: context.formValues.password,
    });
  } else {
    // Register mode - RegisterRequestData interface requires all fields
    const registerData = {
      name: context.formValues.name,
      surname: context.formValues.surname,
      email: context.formValues.email,
      password: context.formValues.password,
      password_confirm: context.formValues.password_confirm,
      dni: context.formValues.dni,
      gender: context.formValues.gender,
      birthdate: context.formValues.birthdate,
      phone: context.formValues.phone,
      specialty: context.formValues.specialty,
      medicalLicense: context.formValues.medicalLicense,
      slotDurationMin: context.formValues.slotDurationMin,
    };

    if (context.isPatient) {
      return await AuthService.registerPatient(registerData);
    } else {
      return await AuthService.registerDoctor(registerData);
    }
  }
};

/**
 * Handle user logout
 */
export const logoutUser = async (): Promise<boolean> => {
  try {
    await AuthService.signOut();
    AuthService.clearAuthData();
    return true;
  } catch (error) {
    console.warn('Logout API call failed, but clearing local data:', error);
    AuthService.clearAuthData();
    return true;
  }
};