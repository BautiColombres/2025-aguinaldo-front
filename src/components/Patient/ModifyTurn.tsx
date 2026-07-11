import {
  Box, Button, Typography,
  Container, Avatar
} from "@mui/material";
import React from "react";
import { useMachines } from "#/providers/MachineProvider";
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DemoContainer, DemoItem } from "@mui/x-date-pickers/internals/demo";
import { DateCalendar } from "@mui/x-date-pickers";
import {
  formatDateTime,
  shouldDisableDate,
  dayjsArgentina,
  nowArgentina
} from "#/utils/dateTimeUtils";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EditIcon from "@mui/icons-material/Edit";
import TimeSlotSelector from "#/components/shared/TimeSlotSelector/TimeSlotSelector";
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import { esES } from '@mui/x-date-pickers/locales';
import "./ModifyTurn.css";

// Set Spanish locale globally for dayjs
dayjs.locale('es');

const ModifyTurn: React.FC = () => {
  const { uiSend, turnState, turnSend } = useMachines();

  const { isLoadingAvailableSlots, modifyError, availableTurns } = turnState.context;
  const { currentTurn, selectedDate, selectedTime, availableDates } = turnState.context.modifyTurn;

  if (!currentTurn) {
    console.error("No current turn found in context:", turnState.context.modifyTurn);
    return (
      <Container maxWidth="md" className="modify-turn-container">
        <Box className="modify-turn-error">
          <Typography variant="h6" color="error">
            No se pudo cargar la información del turno
          </Typography>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => uiSend({ type: "NAVIGATE", to: "/patient/view-turns" })}
            sx={{ mt: 2 }}
            variant="outlined"
          >
            Volver a mis turnos
          </Button>
        </Box>
      </Container>
    );
  }

  return (
    <Box className="shared-container">
      {/* Page Header */}
      <Box className="shared-header">
        <Box className="shared-header-layout">
          <Box className="shared-back-button-container">
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => uiSend({ type: "NAVIGATE", to: "/patient/view-turns" })}
              className="shared-back-button"
              variant="outlined"
            >
              Volver
            </Button>
          </Box>

          <Box className="shared-header-content">
            <Avatar className="shared-header-icon">
              <EditIcon sx={{ fontSize: 28 }} />
            </Avatar>
            <Box>
              <Typography variant="h4" component="h1" className="shared-header-title">
                Modificar Turno
              </Typography>
              <Typography variant="h6" className="shared-header-subtitle">
                Selecciona una nueva fecha y horario para tu cita
              </Typography>
            </Box>
          </Box>

          <Box className="shared-header-spacer"></Box>
        </Box>
      </Box>

      <Container maxWidth="lg" className="shared-page-container">

        <Box className="reservation-step1-container">
          <Box className="reservation-form-section">
            <Typography variant="h6" className="reservation-section-title">
              Información del Turno Actual
            </Typography>
            <Box className="reservation-info-card">
              <Typography variant="body1">
                <strong>Doctor:</strong> {currentTurn.doctorName}
              </Typography>
              <Typography variant="body1">
                <strong>Especialidad:</strong> {currentTurn.doctorSpecialty || 'No especificada'}
              </Typography>
              <Typography variant="body1">
                <strong>Fecha y Hora Actual:</strong> {formatDateTime(currentTurn.scheduledAt)}
              </Typography>
            </Box>
          </Box>
        </Box>

        <Box className="reservation-step2-container">
          <Box className="reservation-step2-content">
            <Box className="reservation-calendar-section">
              <Box className="reservation-calendar-container">
                <LocalizationProvider 
                  dateAdapter={AdapterDayjs} 
                  adapterLocale="es"
                  localeText={esES.components.MuiLocalizationProvider.defaultProps.localeText}
                >
                  <DemoContainer components={['DateCalendar']} sx={{ width: '100%' }}>
                    <DemoItem>
                      <DateCalendar
                        value={selectedDate ? dayjsArgentina(selectedDate) : null}
                        onChange={(newValue) => {
                          turnSend({ type: "UPDATE_FORM", path: ["modifyTurn", "selectedDate"], value: newValue });
                          turnSend({ type: "UPDATE_FORM", path: ["modifyTurn", "selectedTime"], value: null });
                          if (newValue && currentTurn?.doctorId) {
                            turnSend({ 
                              type: "LOAD_MODIFY_AVAILABLE_SLOTS", 
                              doctorId: currentTurn.doctorId, 
                              date: newValue.format('YYYY-MM-DD') 
                            });
                          }
                        }}
                        minDate={nowArgentina()}
                        shouldDisableDate={(date) => shouldDisableDate(date, availableDates)}
                        slotProps={{
                          day: (props: any) => {
                            const { day, ...other } = props;
                            const dateString = day.format('YYYY-MM-DD');
                            const hasAvailability = availableDates.includes(dateString);
                            
                            return {
                              ...other,
                              sx: {
                                ...other.sx,
                                position: 'relative',
                                '&::after': hasAvailability ? {
                                  content: '""',
                                  position: 'absolute',
                                  bottom: '2px',
                                  left: '50%',
                                  transform: 'translateX(-50%)',
                                  width: '4px',
                                  height: '4px',
                                  borderRadius: '50%',
                                  backgroundColor: '#1976d2',
                                  opacity: 0.7,
                                } : {},
                              }
                            };
                          }
                        }}
                      />
                    </DemoItem>
                  </DemoContainer>
                </LocalizationProvider>
              </Box>
              <Typography variant="body2" color="text.secondary" textAlign="center" mt={2}>
                👨‍⚕️ {currentTurn.doctorName}
              </Typography>
            </Box>
            <Box className="reservation-time-section">
              <Box className="reservation-time-slots">
                <TimeSlotSelector
                  selectedDate={selectedDate ? dayjsArgentina(selectedDate) : null}
                  availableSlots={availableTurns}
                  selectedTime={selectedTime}
                  onTimeSelect={(timeSlot) => turnSend({ type: "UPDATE_FORM", path: ["modifyTurn", "selectedTime"], value: timeSlot })}
                  isLoadingSlots={isLoadingAvailableSlots}
                />
              </Box>
            </Box>
          </Box>
        </Box>

        {modifyError && (
          <Box className="reservation-error-message">
            <Typography color="error" variant="body2">
              {modifyError}
            </Typography>
          </Box>
        )}

        <Box className="reservation-actions">
          <Button
            onClick={() => turnSend({ type: "SUBMIT_MODIFY_REQUEST" })}
            variant="contained"
            className="reservation-btn-primary"
            disabled={!selectedDate || !selectedTime}
          >
            ✓ Solicitar Modificación
          </Button>
        </Box>
      </Container>
    </Box>
  );
};

export default ModifyTurn;