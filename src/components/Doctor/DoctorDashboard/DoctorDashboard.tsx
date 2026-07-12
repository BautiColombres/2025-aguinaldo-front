import React, { useEffect } from 'react';
import {
  Box,
  Typography,
  Container,
  Avatar,
  Badge
} from "@mui/material";
import EventAvailableIcon from "@mui/icons-material/EventAvailable";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import PersonIcon from "@mui/icons-material/Person";
import NotificationsIcon from "@mui/icons-material/Notifications";
import BarChartIcon from "@mui/icons-material/BarChart";
import EventRepeatIcon from "@mui/icons-material/EventRepeat";
import LoadingThreeDotsJumping from "../../shared/PageLoadingScreen/LoadingThreeDots";
import BadgeShowcase from "../../shared/Badges/BadgeShowcase";
import type { TurnModifyRequest } from "#/models/TurnModifyRequest";
import { useMachines } from "#/providers/MachineProvider";
import { useAuthMachine } from "#/providers/AuthProvider";
import { SignInResponse } from "#/models/Auth";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import DashboardCard from "../../shared/DashboardCard/DashboardCard";
import DashboardUpcomingCard from "../../shared/DashboardUpcomingCard/DashboardUpcomingCard";
import { dayjsArgentina, nowArgentina } from '#/utils/dateTimeUtils';
import "./DoctorDashboard.css";
import { useDataMachine } from "#/providers/DataProvider";

const DoctorDashboard: React.FC = () => {
  const { dataState } = useDataMachine();
  const dataContext = dataState.context;
  const { uiSend, turnState, doctorState, badgeState, followUpState, followUpSend } = useMachines();

  const turnContext = turnState?.context;
  const doctorContext = doctorState?.context;
  const badgeContext = badgeState?.context;
  const followUpContext = followUpState?.context;
  const authContext = useAuthMachine().authState?.context;
  const user = authContext.authResponse as SignInResponse;

  const dueForFollowUpCount: number = (followUpContext?.dueForFollowUp || []).length;
  const doctorAccessToken = doctorContext?.accessToken;
  const doctorId = doctorContext?.doctorId;

  // F3-F2 — load the "patients who should return" count on mount. useEffect (not a
  // render-phase dispatch) so StrictMode's double render doesn't double-fire.
  useEffect(() => {
    if (doctorAccessToken && doctorId) {
      followUpSend({ type: "LOAD_DUE_FOR_FOLLOWUP", doctorId, accessToken: doctorAccessToken });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctorAccessToken, doctorId]);

  const availability = doctorContext?.availability || [];
  const hasConfiguredDays = availability.some((day: any) => day.enabled && day.ranges?.length > 0);
  const pendingModifyRequests: TurnModifyRequest[] = dataContext.doctorModifyRequests?.filter((r: TurnModifyRequest) => r.status === "PENDING") || [];


  const isLoading = dataContext.loading?.initializing ||
                    dataContext.loading?.myTurns || 
                    dataContext.loading?.doctorPatients || 
                    dataContext.loading?.doctorAvailability || 
                    dataContext.loading?.doctorModifyRequests ||
                    doctorContext.isLoadingAvailability;
  
  const upcomingTurns = (turnContext?.myTurns || [])
    .filter((turn: any) => {
      const turnDate = dayjsArgentina(turn.scheduledAt);
      const now = nowArgentina();
      const isUpcoming = turnDate.isAfter(now);
      
      return isUpcoming && turn.status === 'SCHEDULED';
    })
    .slice(0, 10)
    .sort((a: any, b: any) => dayjsArgentina(a.scheduledAt).diff(dayjsArgentina(b.scheduledAt))); 
    
  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box className="dashboard-container">
        { isLoading && (
          <Box className="dashboard-loading-overlay">
            <LoadingThreeDotsJumping />
          </Box>
        )}
        
        <Container maxWidth="lg">
          <Box className="dashboard-header-section">
            <Box className="dashboard-header-content">
              <Avatar className="dashboard-header-avatar doctor-header-avatar">
                <PersonIcon className="dashboard-header-icon" />
              </Avatar>
              <Box>
                <Typography variant="h4" component="h1" className="dashboard-header-title">
                  Hola, Dr. {user.name|| 'Doctor'} {user.surname|| 'Apellido'}
                </Typography>
                <Typography variant="h6" className="dashboard-header-subtitle doctor-header-subtitle">
                  Gestiona tus turnos y pacientes
                </Typography>
              </Box>
            </Box>
          </Box>

          <Box className="dashboard-actions-container">
            <DashboardUpcomingCard
              type="doctor"
              title="Mis Turnos"
              turns={upcomingTurns}
              isLoading={turnContext?.isLoadingMyTurns}
              error={turnContext?.myTurnsError}
              emptyMessage="No tenés turnos próximos"
              onViewAll={() => uiSend({ type: "NAVIGATE", to: "/doctor/view-turns" })}
            />

            <DashboardCard
              type="doctor"
              variant="secondary"
              icon={<PeopleAltIcon className="doctor-action-icon" />}
              title="Pacientes"
              description="Ver y administrar tu lista de pacientes"
              buttonText="Ver Pacientes"
              onClick={() => uiSend({ type: "NAVIGATE", to: "/doctor/view-patients" })}
            />

            {pendingModifyRequests.length > 0 ? (
              <Badge 
                badgeContent={pendingModifyRequests.length} 
                color="error" 
                className="doctor-badge-pulse"
              >
                <DashboardCard
                  type="doctor"
                  variant="primary"
                  icon={<NotificationsIcon className="doctor-action-icon" />}
                  title="Solicitudes Pendientes"
                  description="Gestiona solicitudes de modificación de turnos"
                  buttonText="Ver Solicitudes"
                  onClick={() => uiSend({ type: "NAVIGATE", to: "/doctor/turns-modifications" })}
                />
              </Badge>
            ) : (
              <DashboardCard
                type="doctor"
                variant="primary"
                icon={<NotificationsIcon className="doctor-action-icon" />}
                title="Solicitudes Pendientes"
                description="Gestiona solicitudes de modificación de turnos"
                buttonText="Ver Solicitudes"
                onClick={() => uiSend({ type: "NAVIGATE", to: "/doctor/turns-modifications" })}
              />
            )}

            <DashboardCard
              type="doctor"
              variant={isLoading ? "accent" : (hasConfiguredDays ? "accent" : "warning")}
              icon={hasConfiguredDays ? <EventAvailableIcon className="doctor-action-icon" /> : <ErrorOutlineIcon className="doctor-action-icon" />}
              title="Disponibilidad"
              description={hasConfiguredDays ? "Define los horarios disponibles para reservas" : "No tienes horarios configurados"}
              buttonText={hasConfiguredDays ? "Configurar" : "Configurar Ahora"}
              onClick={() => uiSend({ type: "NAVIGATE", to: "/doctor/enable-hours" })}
              warning={!hasConfiguredDays && !isLoading}
            />

            <DashboardCard
              type="doctor"
              variant="primary"
              icon={<BarChartIcon className="doctor-action-icon" />}
              title="Métricas"
              description="Ver estadísticas detalladas de tu actividad médica"
              buttonText="Ver Métricas"
              onClick={() => uiSend({ type: "NAVIGATE", to: "/doctor/metrics" })}
            />

            <DashboardCard
              type="doctor"
              variant="secondary"
              icon={<EventRepeatIcon className="doctor-action-icon" />}
              title="Seguimiento pendiente"
              description={
                dueForFollowUpCount > 0
                  ? `${dueForFollowUpCount} paciente${dueForFollowUpCount !== 1 ? 's' : ''} ${dueForFollowUpCount !== 1 ? 'deben' : 'debe'} volver y no ${dueForFollowUpCount !== 1 ? 'tienen' : 'tiene'} un turno próximo`
                  : "No hay pacientes con seguimiento pendiente"
              }
              buttonText="Ver seguimientos"
              badge={dueForFollowUpCount}
              onClick={() => uiSend({ type: "NAVIGATE", to: "/doctor/follow-up-panel" })}
            />
          </Box>

          <BadgeShowcase
            badges={badgeContext?.badges || []}
            progress={badgeContext?.progress || []}
            isLoading={badgeContext?.isLoadingBadges || badgeContext?.isLoadingProgress}
            onViewAll={() => uiSend({ type: "NAVIGATE", to: "/doctor/badges" })}
          />
        </Container>
      </Box>
    </LocalizationProvider>
  );
};

export default DoctorDashboard;
