import React from 'react';
import {
  Box, 
  Typography, 
  Avatar,
  Card,
  CardContent,
  CircularProgress
} from "@mui/material";
import StarIcon from "@mui/icons-material/Star";
import BarChartIcon from "@mui/icons-material/BarChart";
import { useMachines } from "#/providers/MachineProvider";
import { useAuthMachine } from "#/providers/AuthProvider";
import { SignInResponse } from "#/models/Auth";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { SubcategoryCount } from "#/service/doctor-service.service";
import "./DoctorMetrics.css";


const DoctorMetrics: React.FC = () => {
  const { doctorState, doctorSend } = useMachines();
  const doctorContext = doctorState?.context;
  const authContext = useAuthMachine().authState?.context;
  const user = authContext.authResponse as SignInResponse;

  // Load metrics when component mounts
  React.useEffect(() => {
    if (doctorContext?.accessToken && doctorContext?.doctorId && !doctorContext?.metrics && !doctorContext?.isLoadingMetrics) {
      doctorSend({ type: "LOAD_METRICS" });
    }
  }, [doctorContext?.accessToken, doctorContext?.doctorId, doctorContext?.metrics, doctorContext?.isLoadingMetrics, doctorSend]);

  const isLoading = doctorContext?.isLoadingMetrics;
  const metrics = doctorContext?.metrics;
  const metricsError = doctorContext?.metricsError;

  const displayScore = metrics?.score != null ? metrics.score.toFixed(2) : 'N/A';

  const completionRate = React.useMemo(() => {
    const completed = metrics?.completedTurnsThisMonth ?? 0;
    const cancelled = metrics?.cancelledTurns ?? 0;

    if (completed === 0) {
      return null;
    }

    const total = completed + cancelled;

    if (total === 0) {
      return null;
    }

    return ((completed / total) * 100).toFixed(1);
  }, [metrics?.completedTurnsThisMonth, metrics?.cancelledTurns]);

  // Parse and aggregate subcategories
  const parsedSubcategories = React.useMemo(() => {
    if (!metrics?.ratingSubcategories || metrics.ratingSubcategories.length === 0) {
      return [];
    }

    // Create a map to count each subcategory
    const subcategoryMap = new Map<string, number>();

    metrics.ratingSubcategories.forEach((item: SubcategoryCount) => {
      // Split the comma-separated string
      const categories = item.subcategory.split(',').map(cat => cat.trim());
      
      categories.forEach(category => {
        if (category) {
          const currentCount = subcategoryMap.get(category) || 0;
          subcategoryMap.set(category, currentCount + item.count);
        }
      });
    });

    // Convert map to array and sort by count
    return Array.from(subcategoryMap.entries())
      .map(([subcategory, count]) => ({ subcategory, count }))
      .sort((a, b) => b.count - a.count);
  }, [metrics?.ratingSubcategories]);
    
  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box className="shared-container">
        {/* Header Section */}
        <Box className="shared-header">
          <Box className="shared-header-layout">
            <Box className="shared-header-content">
              <Avatar className="shared-header-icon doctor-header-avatar">
                <BarChartIcon sx={{ fontSize: 28 }} />
              </Avatar>
              <Box>
                <Typography variant="h4" component="h1" className="shared-header-title">
                  Métricas del Dr. {user.name || 'Doctor'}
                </Typography>
                <Typography variant="h6" className="shared-header-subtitle doctor-header-subtitle">
                  Estadísticas detalladas de tu actividad médica
                </Typography>
              </Box>
            </Box>
            <Box className="shared-header-spacer">
              {isLoading && <CircularProgress />}
            </Box>
          </Box>
        </Box>

        {metricsError && (
          <Box sx={{ mb: 2, p: 2, bgcolor: 'error.light', borderRadius: 1 }}>
            <Typography color="error.contrastText">{metricsError}</Typography>
          </Box>
        )}

        <Box className="metrics-content">
          {!isLoading && metrics && (
            <>
              {/* Summary Section - Now First */}
              <Box className="summary-section">
                <Box className="metrics-section-header">
                  <Typography variant="h5" className="metrics-section-title">
                    Resumen de Actividad
                  </Typography>
                  <Typography variant="body2" className="metrics-section-subtitle">
                    Vista consolidada de tu desempeño profesional
                  </Typography>
                </Box>
                <Box className="summary-grid">
                  <Box className="summary-card">
                    <Typography className="summary-card-title">Especialidad</Typography>
                    <Typography className="summary-card-value">
                      {metrics.specialty || 'No especificada'}
                    </Typography>
                  </Box>
                  <Box className="summary-card">
                    <Typography className="summary-card-title">Calificación Promedio</Typography>
                    <Typography className="summary-card-value">
                      {displayScore} / 5.0
                    </Typography>
                  </Box>
                  <Box className="summary-card">
                    <Typography className="summary-card-title">Pacientes Únicos</Typography>
                    <Typography className="summary-card-value">
                      {metrics.totalPatients} {metrics.totalPatients === 1 ? 'paciente' : 'pacientes'}
                    </Typography>
                  </Box>
                  <Box className="summary-card">
                    <Typography className="summary-card-title">Turnos Próximos</Typography>
                    <Typography className="summary-card-value">
                      {metrics.upcomingTurns} programados
                    </Typography>
                  </Box>
                  <Box className="summary-card">
                    <Typography className="summary-card-title">Turnos Completados</Typography>
                    <Typography className="summary-card-value">
                      {metrics.completedTurnsThisMonth} este mes
                    </Typography>
                  </Box>
                  <Box className="summary-card">
                    <Typography className="summary-card-title">Turnos Cancelados</Typography>
                    <Typography className="summary-card-value">
                      {metrics.cancelledTurns} {metrics.cancelledTurns === 1 ? 'cancelado' : 'cancelados'}
                    </Typography>
                  </Box>
                  <Box className="summary-card">
                    <Typography className="summary-card-title">Tasa de Finalización</Typography>
                    <Typography className="summary-card-value">
                      {completionRate !== null ? `${completionRate}%` : 'Sin datos'}
                    </Typography>
                  </Box>
                </Box>
              </Box>

              {/* Rating Subcategories Section */}
              {parsedSubcategories.length > 0 ? (
                <Box className="rating-categories-section">
                  <Box className="metrics-section-header">
                    <Typography variant="h5" className="metrics-section-title">
                      Feedback de Pacientes
                    </Typography>
                    <Typography variant="body2" className="metrics-section-subtitle">
                      Categorías más valoradas en tus consultas ({parsedSubcategories.reduce((sum, cat) => sum + cat.count, 0)} menciones totales)
                    </Typography>
                  </Box>
                  <Box className="rating-categories-grid">
                    {parsedSubcategories.map((subcategory, index: number) => (
                      <Card key={`${subcategory.subcategory}-${index}`} className={`rating-category-card ${index < 3 ? 'rating-card-top' : ''}`}>
                        <CardContent className="rating-category-content">
                          {index < 3 && <StarIcon className="rating-category-star" />}
                          <Typography className="rating-category-name" component="div">
                            {subcategory.subcategory}
                          </Typography>
                          <Typography className="rating-category-count" component="div">
                            {subcategory.count} {subcategory.count === 1 ? 'mención' : 'menciones'}
                          </Typography>
                        </CardContent>
                      </Card>
                    ))}
                  </Box>
                </Box>
              ) : (
                <Box className="rating-categories-section">
                  <Box className="metrics-section-header">
                    <Typography variant="h5" className="metrics-section-title">
                      Feedback de Pacientes
                    </Typography>
                    <Typography variant="body2" className="metrics-section-subtitle">
                      Aún no hay feedback de pacientes
                    </Typography>
                  </Box>
                  <Box className="no-feedback-message">
                    <Typography className="no-feedback-text">
                      Cuando los pacientes califiquen tus consultas, verás aquí las categorías más valoradas.
                    </Typography>
                  </Box>
                </Box>
              )}
            </>
          )}
        </Box>
      </Box>
    </LocalizationProvider>
  );
};

export default DoctorMetrics;