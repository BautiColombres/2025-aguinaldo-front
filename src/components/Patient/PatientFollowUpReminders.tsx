import React from "react";
import { Box, Paper, Typography, Divider, List, ListItem, ListItemIcon, ListItemText } from "@mui/material";
import EventAvailableIcon from "@mui/icons-material/EventAvailable";
import { useMachines } from "#/providers/MachineProvider";
import { useAuthMachine } from "#/providers/AuthProvider";
import type { FollowUpReminder } from "#/models/FollowUpReminder";
import { formatDate } from "#/utils/dateTimeUtils";

// Patient-facing follow-up reminders (F2-F4b — BASELINE, minimal).
// HARD PHI RULE: copy is GENERIC — it shows only the recommended control date,
// never the clinical tag/motive behind the reminder.
const formatControlDate = (value: string): string => {
  // scheduledFor is a date-only LocalDate ("YYYY-MM-DD"); format it directly to
  // avoid a timezone conversion shifting the day.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-');
    return `${d}/${m}/${y}`;
  }
  return formatDate(value);
};

const PatientFollowUpReminders: React.FC = () => {
  const { followUpState, followUpSend } = useMachines();
  const { authState } = useAuthMachine();

  const accessToken: string | undefined = authState?.context?.authResponse?.accessToken;
  const patientId: string | undefined = authState?.context?.authResponse?.id;
  const reminders: FollowUpReminder[] = followUpState?.context?.patientReminders || [];

  React.useEffect(() => {
    if (accessToken && patientId) {
      followUpSend({ type: "LOAD_PATIENT_FOLLOWUPS", patientId, accessToken });
    }
    // Load once when auth is available.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, patientId]);

  return (
    <Paper elevation={1} sx={{ p: 3 }} data-testid="patient-followup-reminders">
      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <EventAvailableIcon color="primary" />
        Recordatorios de control
      </Typography>
      <Divider sx={{ mb: 2 }} />
      {reminders.length === 0 ? (
        <Typography variant="body2" color="textSecondary" sx={{ fontStyle: 'italic' }}>
          No tenés recordatorios de control pendientes.
        </Typography>
      ) : (
        <List dense disablePadding>
          {reminders.map((r) => (
            <ListItem key={r.id} disableGutters data-testid="patient-followup-item">
              <ListItemIcon sx={{ minWidth: 36 }}>
                <EventAvailableIcon fontSize="small" color="primary" />
              </ListItemIcon>
              <ListItemText
                primary="Tu profesional te recomienda un control"
                secondary={
                  <Box component="span">
                    Control recomendado para el {formatControlDate(r.scheduledFor)}
                  </Box>
                }
              />
            </ListItem>
          ))}
        </List>
      )}
    </Paper>
  );
};

export default PatientFollowUpReminders;
