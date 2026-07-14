import React, { useEffect } from 'react';
import {
  Avatar,
  Box,
  List,
  ListItem,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Typography,
  CircularProgress,
} from '@mui/material';
import { EventRepeatOutlined, ChevronRight, CalendarMonthOutlined } from '@mui/icons-material';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import { useMachines } from '#/providers/MachineProvider';
import type { DueForFollowUp } from '#/models/FollowUpReminder';
import './FollowUpPanel.css';

const FollowUpPanel: React.FC = () => {
  const { followUpState, followUpSend, doctorState, doctorSend, uiSend } = useMachines();

  const followUpContext = followUpState?.context;
  const doctorContext = doctorState?.context;

  const duePatients: DueForFollowUp[] = followUpContext?.dueForFollowUp || [];
  const isLoading: boolean = Boolean(followUpContext?.isLoading);

  const accessToken = doctorContext?.accessToken;
  const doctorId = doctorContext?.doctorId;

  useEffect(() => {
    if (accessToken && doctorId) {
      followUpSend({ type: 'LOAD_DUE_FOR_FOLLOWUP', doctorId, accessToken });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, doctorId]);

  const getInitials = (name: string, surname: string) =>
    ((name?.[0] || '') + (surname?.[0] || '')).toUpperCase();

  const formatDateOnly = (value: string) => dayjs(value.slice(0, 10)).format('DD/MM/YYYY');

  const formatLastVisit = (lastTurnDate: string | null) =>
    lastTurnDate ? formatDateOnly(lastTurnDate) : '—';

  const handleOpenPatient = (patient: DueForFollowUp) => {
    doctorSend({ type: 'SELECT_PATIENT', patientId: patient.patientId });
    uiSend({ type: 'NAVIGATE', to: `/patient-detail?patientId=${patient.patientId}` });
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box className="followuppanel-container">
        <Box className="shared-header">
          <Box className="shared-header-layout">
            <Box className="shared-header-content">
              <Avatar className="shared-header-icon">
                <EventRepeatOutlined sx={{ fontSize: 28 }} />
              </Avatar>
              <Box>
                <Typography variant="h4" component="h1" className="shared-header-title">
                  Pacientes con seguimiento pendiente
                </Typography>
                <Typography variant="h6" className="shared-header-subtitle">
                  Pacientes que deberían volver y no tienen un turno próximo
                </Typography>
              </Box>
            </Box>
            <Box className="shared-header-spacer"></Box>
          </Box>
        </Box>

        <Box className="followuppanel-content">
          {isLoading ? (
            <Box className="followuppanel-empty-state">
              <CircularProgress size={40} />
              <Typography variant="h6" gutterBottom>
                Cargando pacientes...
              </Typography>
            </Box>
          ) : duePatients.length > 0 ? (
            <Box className="followuppanel-list-container">
              <List>
                {duePatients.map((patient) => (
                  <ListItem key={patient.patientId} disablePadding>
                    <ListItemButton
                      onClick={() => handleOpenPatient(patient)}
                      className="followuppanel-patient-card"
                    >
                      <ListItemAvatar>
                        <Avatar className="followuppanel-patient-avatar">
                          {getInitials(patient.patientName, patient.patientSurname)}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Typography className="followuppanel-patient-name">
                            {patient.patientName} {patient.patientSurname}
                          </Typography>
                        }
                        secondary={
                          <>
                            <Box className="followuppanel-control-date">
                              <CalendarMonthOutlined sx={{ fontSize: 16 }} />
                              <span>Control recomendado: {formatDateOnly(patient.scheduledFor)}</span>
                            </Box>
                            <Box className="followuppanel-last-visit">
                              <span>Última visita: {formatLastVisit(patient.lastTurnDate)}</span>
                            </Box>
                          </>
                        }
                        secondaryTypographyProps={{ component: 'div' }}
                      />
                      <ChevronRight color="action" />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </Box>
          ) : (
            <Box className="followuppanel-empty-state">
              <Avatar className="followuppanel-empty-icon">
                <EventRepeatOutlined />
              </Avatar>
              <Typography variant="h6" gutterBottom>
                No hay pacientes con seguimiento pendiente
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Cuando un paciente tenga un control recomendado y sin turno próximo, aparecerá acá.
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
    </LocalizationProvider>
  );
};

export default FollowUpPanel;
