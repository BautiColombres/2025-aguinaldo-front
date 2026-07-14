import './App.css'
import { Routes, Route, useNavigate } from 'react-router-dom'
import HomeScreen from './components/HomeScreen/HomeScreen'
import { useAuthMachine } from './providers/AuthProvider'
import { Box } from '@mui/material'
import PendingScreen from './components/Admin/PendingScreen/PendingScreen'
import AdminPatients from './components/Admin/AdminPatients'
import AdminDoctors from './components/Admin/AdminDoctors'
import ProfileScreen from './components/ProfileScreen/ProfileScreen'
import ReservationTurns from './components/Patient/ReservationTurns'
import ViewTurns from './components/Patient/ViewTurns'
import ModifyTurn from './components/Patient/ModifyTurn'
import EnableHours from './components/Doctor/EnableHours/EnableHours'
import ViewPatients from './components/Doctor/ViewPatients/ViewPatients'
import FollowUpPanel from './components/Doctor/FollowUpPanel/FollowUpPanel'
import DoctorViewTurns from './components/Doctor/DoctorViewTurns/DoctorViewTurns'
import PatientDetails from './components/Doctor/PatientDetails/PatientDetails'
import SnackbarAlert from './components/shared/SnackbarAlert/SnackbarAlert'
import PendingActivation from './components/Doctor/PendingActivation/PendingActivation'
import TurnsModifications from './components/Doctor/TurnsModifications/TurnsModifications'
import DoctorMetrics from './components/Doctor/DoctorMetrics/DoctorMetrics'
import DoctorBadges from './components/Doctor/DoctorBadges/DoctorBadges'
import PatientBadges from './components/Patient/PatientBadges/PatientBadges'
import FloatingMenu from './components/shared/FloatingMenu/FloatingMenu'
import NotificationBell from './components/Notifications/NotificationBell'
import NotificationModal from './components/Notifications/NotificationModal'
import { useEffect } from 'react'
import { useMachines } from './providers/MachineProvider'
import ConfirmationModal from './components/shared/ConfirmationModal/ConfirmationModal'
import RatingModal from './components/shared/RatingModal/RatingModal';

function AppContent() {
  const { authState } = useAuthMachine();
  const { uiSend, uiState } = useMachines();
  const navigate = useNavigate();
  const authContext = authState.context;

  const userRole = authContext.authResponse?.role || '';
  const userStatus = authContext.authResponse?.status || '';

  const isActive = userStatus === "ACTIVE";
  const isNotificationModalOpen = uiState?.context?.notificationModal?.open || false;

  useEffect(() => {
    uiSend({ type: "ADD_NAVIGATE_HOOK", navigate, initialPath: window.location.pathname + window.location.search });
  }, [uiSend, navigate]);

  const handleCloseNotificationModal = () => {
    uiSend({ type: "CLOSE_NOTIFICATION_MODAL" });
  };

  const renderAdminRoutes = () => (
    <>
      <Route path="/admin/pending" element={<PendingScreen />} />
      <Route path="/admin/patients" element={<AdminPatients />} />
      <Route path="/admin/doctors" element={<AdminDoctors />} />
    </>
  );

  const renderDoctorRoutes = () => (
    <>
      {isActive ? (
        <>
          <Route path="/doctor/enable-hours" element={<EnableHours />} />
          <Route path="/doctor/view-patients" element={<ViewPatients />} />
          <Route path="/doctor/follow-up-panel" element={<FollowUpPanel />} />
          <Route path="/doctor/view-turns" element={<DoctorViewTurns />} />
          <Route path="/doctor/metrics" element={<DoctorMetrics />} />
          <Route path="/doctor/badges" element={<DoctorBadges />} />
          <Route path="/patient-detail" element={<PatientDetails />} />
          <Route path="/doctor/turns-modifications" element={<TurnsModifications />} />
        </>
      ) : (
        <Route path="/pending-activation" element={<PendingActivation />} />
      )}
    </>
  );

  const renderPatientRoutes = () => (
    <>
      <Route path="/patient/reservation-turns" element={<ReservationTurns />} />
      <Route path="/patient/view-turns" element={<ViewTurns />} />
      <Route path="/patient/modify-turn" element={<ModifyTurn />} />
      <Route path="/patient/badges" element={<PatientBadges />} />
    </>
  );

  return (
      <Box>
        
        {isActive && (
          <>
            <Box className="app-header" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <FloatingMenu />
                <Box onClick={() => uiSend({ type: "NAVIGATE", to: '/' })} style={{ cursor: 'pointer', marginLeft: '16px' }}>
                  <h2>MediBook</h2>
                </Box>
              </Box>
              <NotificationBell />
            </Box>
          </>
        )}

        <Routes>
          <Route path="*" element={<HomeScreen />} />

          {userRole === 'ADMIN' && renderAdminRoutes()}
          {userRole === 'DOCTOR' && renderDoctorRoutes()}
          {userRole === 'PATIENT' && renderPatientRoutes()}
          
          <Route path="/profile" element={<ProfileScreen />} />
          
        </Routes>
        <SnackbarAlert />
        <ConfirmationModal />
        <RatingModal />
        <NotificationModal 
          open={isNotificationModalOpen} 
          onClose={handleCloseNotificationModal} 
        />
      </Box>
  );
}

function App() {
  return (
      <AppContent />
  );
}

export default App