import { useRef, useState } from "react";
import { useMachines } from "#/providers/MachineProvider";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography
} from "@mui/material";
import { approveModifyRequest, rejectModifyRequest } from "#/utils/turnModificationsUtils";
import { useAuthMachine } from "#/providers/AuthProvider";
import { SignInResponse } from "#/models/Auth";
import { orchestrator } from "#/core/Orchestrator";

export default function ConfirmationModal() {
    const { uiState, uiSend, turnSend } = useMachines();
    const { authState } = useAuthMachine();
    const user: SignInResponse = authState?.context?.authResponse || {};

    const dialogData = uiState.context.confirmDialog;

    const [pending, setPending] = useState(false);
    const pendingRef = useRef(false);

    const handleConfirm = async () => {
        if (pendingRef.current) return;
        pendingRef.current = true;
        setPending(true);

        try {
            const action = dialogData.action;

            if (action === 'cancel_turn' && dialogData.turnId) {
                turnSend({
                    type: "CANCEL_TURN",
                    turnId: dialogData.turnId
                });
            } else if (action === 'complete_turn' && dialogData.turnId) {
                turnSend({
                    type: "COMPLETE_TURN",
                    turnId: dialogData.turnId
                });
            } else if (action === 'no_show_turn' && dialogData.turnId) {
                turnSend({
                    type: "NO_SHOW_TURN",
                    turnId: dialogData.turnId
                });
            } else if (action === 'approve' && dialogData.requestId) {
                if (!user.accessToken) return;
                await approveModifyRequest(dialogData.requestId, user.accessToken);
            } else if (action === 'reject' && dialogData.requestId) {
                if (!user.accessToken) return;
                await rejectModifyRequest(dialogData.requestId, user.accessToken);
            } else if (action === 'delete_file' && dialogData.turnId) {
                orchestrator.send({
                    type: "DELETE_TURN_FILE",
                    turnId: dialogData.turnId
                });
            }

            uiSend({ type: "CLOSE_CONFIRMATION_DIALOG" });
        } finally {
            pendingRef.current = false;
            setPending(false);
        }
    };

  return (
    <Dialog open={dialogData.open} onClose={() => uiSend({ type: "CLOSE_CONFIRMATION_DIALOG" })}>
        <DialogTitle>{dialogData.title || 'Confirmar Acción'}</DialogTitle>
        <DialogContent>
          <Typography>
            {dialogData.message || ''}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => uiSend({ type: "CLOSE_CONFIRMATION_DIALOG" })}>Cancelar</Button>
          <Button
            onClick={handleConfirm}
            color={dialogData.confirmButtonColor || 'primary'}
            disabled={pending}
          >
            {dialogData.confirmButtonText || 'Confirmar'}
          </Button>
        </DialogActions>
    </Dialog>
  );
}