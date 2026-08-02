import { EarthDashboard } from '@/engine/Dashboard';

// Initialize the dashboard
const dashboard = new EarthDashboard();
dashboard.init();
dashboard.start();

// Expose for debugging
(window as any).dashboard = dashboard;
(window as any).dataProvider = dashboard.getDataProvider();
(window as any).cameraDemo = dashboard.getCameraDemo();
(window as any).DashboardData = dashboard.getLatestData;

