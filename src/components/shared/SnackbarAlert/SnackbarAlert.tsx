import type React from "react";
import { Snackbar, Alert } from "@mui/material";
import { useMachines } from "../../../providers/MachineProvider";

function SnackbarAlert() {
  const { uiState, uiSend } = useMachines();
  const { snackbar } = uiState.context;

  // FBUG-L4 — MUI owns the auto-hide timer via `autoHideDuration`; it resets on each
  // new snackbar, so timers can no longer stack/leak. Ignore clickaway so the
  // snackbar only closes on timeout or an explicit user action.
  const handleClose = (_event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === "clickaway") {
      return;
    }
    uiSend({ type: "CLOSE_SNACKBAR" });
  };

  return (
    <Snackbar
      open={snackbar.open}
      autoHideDuration={6000}
      onClose={handleClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
    >
      <Alert
        onClose={handleClose}
        severity={snackbar.severity}
        variant="filled"
        sx={{ width: '100%' }}
      >
        {snackbar.message}
      </Alert>
    </Snackbar>
  );
}

export default SnackbarAlert;