import React from "react";
import {
  Box, 
  Typography, 
  Container,
  Avatar
} from "@mui/material";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import PersonIcon from "@mui/icons-material/Person";
import { useMachines } from "#/providers/MachineProvider";
import { useAuthMachine } from "#/providers/AuthProvider";
import { SignInResponse } from "#/models/Auth";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import DashboardCard from "../shared/DashboardCard/DashboardCard";
import DashboardUpcomingCard from "../shared/DashboardUpcomingCard/DashboardUpcomingCard";
import BadgeShowcase from "../shared/Badges/BadgeShowcase";
import { dayjsArgentina, nowArgentina } from '#/utils/dateTimeUtils';
import "./PatientDashboard.css";
import LoadingThreeDotsJumping from "../shared/PageLoadingScreen/LoadingThreeDots";
import { useDataMachine } from "#/providers/DataProvider";
import PatientFollowUpReminders from "./PatientFollowUpReminders";

const PatientDashboard: React.FC = () => {
  const { uiSend, turnState, badgeState } = useMachines();
  const { authState } = useAuthMachine();
  const { dataState } = useDataMachine();
  const user: SignInResponse = authState?.context?.authResponse || {};
  const turnContext = turnState?.context || {};
  const badgeContext = badgeState?.context;
  const dataContext = dataState.context;

  // Patient dashboard needs to wait for ALL patient-specific data to be loaded
  const isLoading = dataContext.loading?.initializing ||
                   dataContext.loading?.doctors || 
                   dataContext.loading?.myTurns || 
                   dataContext.loading?.myModifyRequests ||
                   turnContext.isLoadingMyTurns;
  
  const upcomingTurns = (turnContext.myTurns || [])
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
          <Box 
            sx={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              bgcolor: 'rgba(255, 255, 255, 0.8)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              backdropFilter: 'blur(4px)'
            }}
          >
            <LoadingThreeDotsJumping />
          </Box>
        )}
        <Container maxWidth="lg">
          <Box className="dashboard-header-section">
            <Box className="dashboard-header-content">
              <Avatar className="dashboard-header-avatar patient-header-avatar">
                <PersonIcon className="dashboard-header-icon" />
              </Avatar>
              <Box>
                <Typography variant="h4" component="h1" className="dashboard-header-title">
                  Hola, {user.name || 'Paciente'}
                </Typography>
                <Typography variant="h6" className="dashboard-header-subtitle patient-header-subtitle">
                  Gestiona tus turnos médicos y citas
                </Typography>
              </Box>
            </Box>
          </Box>

          <Box className="dashboard-actions-container">

            <DashboardUpcomingCard
              type="patient"
              title="Mis Turnos"
              turns={upcomingTurns}
              isLoading={turnContext.isLoadingMyTurns}
              error={turnContext.myTurnsError}
              emptyMessage="No tenés turnos próximos"
              onViewAll={() => uiSend({ type: "NAVIGATE", to: "/patient/view-turns" })}
            />

            <DashboardCard
              type="patient"
              variant="secondary"
              icon={<CalendarTodayIcon className="patient-action-icon" />}
              title="Reservar Turno"
              description="Agenda una nueva cita médica con tu especialista preferido"
              buttonText="Nuevo Turno"
              onClick={() => uiSend({ type: "NAVIGATE", to: "/patient/reservation-turns" })}
            />
          </Box>

          <Box sx={{ mt: 3 }}>
            <PatientFollowUpReminders />
          </Box>

          <BadgeShowcase
            badges={badgeContext?.badges || []}
            progress={badgeContext?.progress || []}
            isLoading={badgeContext?.isLoadingBadges || badgeContext?.isLoadingProgress}
            onViewAll={() => uiSend({ type: "NAVIGATE", to: "/patient/badges" })}
          />
        </Container>
      </Box>
    </LocalizationProvider>
  );
};

export default PatientDashboard;
