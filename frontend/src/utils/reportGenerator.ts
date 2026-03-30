/**
 * Report Generator Utility
 *
 * Generates CSV and PDF reports from analytics data
 */

// ============================================================================
// CSV Generation
// ============================================================================

/**
 * Convert array of objects to CSV string
 */
export const generateCSV = (data: Record<string, unknown>[]): string => {
  if (!data || data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(','), // Header row
    ...data.map((row) =>
      headers
        .map((header) => {
          const value = row[header];
          // Escape quotes and wrap in quotes if contains comma or quote
          const escaped = String(value ?? '').replace(/"/g, '""');
          return escaped.includes(',') || escaped.includes('"') || escaped.includes('\n')
            ? `"${escaped}"`
            : escaped;
        })
        .join(',')
    ),
  ];

  return csvRows.join('\n');
};

/**
 * Download CSV file
 */
export const downloadCSV = (data: Record<string, unknown>[], filename: string) => {
  const csv = generateCSV(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// ============================================================================
// Report Data Formatters
// ============================================================================

/**
 * Format revenue trends data for export
 */
export const formatRevenueTrendsForExport = (data: {
  data: { date: string; revenue: number; appointment_count: number }[];
  total_revenue: number;
  total_appointments: number;
}) => {
  return [
    { metric: 'Total Revenue', value: `$${data.total_revenue.toFixed(2)}` },
    { metric: 'Total Appointments', value: data.total_appointments.toString() },
    {}, // Empty row
    { date: 'Date', revenue: 'Revenue', appointments: 'Appointment Count' }, // Header
    ...data.data.map((d) => ({
      date: d.date,
      revenue: `$${d.revenue.toFixed(2)}`,
      appointments: d.appointment_count,
    })),
  ];
};

/**
 * Format revenue by service data for export
 */
export const formatRevenueByServiceForExport = (data: {
  data: { service: string; count: number; revenue: number }[];
}) => {
  return [
    { service: 'Service', bookings: 'Bookings', revenue: 'Revenue' },
    ...data.data.map((d) => ({
      service: d.service,
      bookings: d.count,
      revenue: `$${d.revenue.toFixed(2)}`,
    })),
  ];
};

/**
 * Format appointments data for export
 */
export const formatAppointmentsForExport = (data: {
  byDay?: { day: string; count: number }[];
  byHour?: { hour: number; count: number }[];
  status?: { status: string; count: number }[];
  cancellation?: {
    total_appointments: number;
    cancelled: number;
    no_shows: number;
    cancellation_rate: number;
    no_show_rate: number;
  };
}) => {
  const rows: Record<string, unknown>[] = [];

  // By Day of Week
  if (data.byDay && data.byDay.length > 0) {
    rows.push({ section: 'Appointments by Day of Week' }, {});
    rows.push({ day: 'Day', count: 'Count' });
    data.byDay.forEach((d) => rows.push({ day: d.day, count: d.count }));
    rows.push({});
  }

  // By Hour
  if (data.byHour && data.byHour.length > 0) {
    rows.push({ section: 'Appointments by Hour' }, {});
    rows.push({ hour: 'Hour', count: 'Count' });
    data.byHour.forEach((d) =>
      rows.push({ hour: `${d.hour}:00`, count: d.count })
    );
    rows.push({});
  }

  // Status Breakdown
  if (data.status && data.status.length > 0) {
    rows.push({ section: 'Status Breakdown' }, {});
    rows.push({ status: 'Status', count: 'Count' });
    data.status.forEach((d) => rows.push({ status: d.status, count: d.count }));
    rows.push({});
  }

  // Cancellation Rate
  if (data.cancellation) {
    rows.push({ section: 'Cancellation Analytics' }, {});
    rows.push({
      metric: 'Total Appointments',
      value: data.cancellation.total_appointments,
    });
    rows.push({
      metric: 'Cancelled',
      value: data.cancellation.cancelled,
    });
    rows.push({
      metric: 'No-Shows',
      value: data.cancellation.no_shows,
    });
    rows.push({
      metric: 'Cancellation Rate',
      value: `${data.cancellation.cancellation_rate}%`,
    });
    rows.push({
      metric: 'No-Show Rate',
      value: `${data.cancellation.no_show_rate}%`,
    });
  }

  return rows;
};

/**
 * Format staff utilization data for export
 */
export const formatStaffUtilizationForExport = (data: {
  data: {
    user_id: string;
    name: string;
    appointment_count: number;
    revenue_generated: number;
  }[];
}) => {
  return [
    { staff: 'Staff Member', appointments: 'Appointments', revenue: 'Revenue Generated' },
    ...data.data.map((d) => ({
      staff: d.name,
      appointments: d.appointment_count,
      revenue: `$${d.revenue_generated.toFixed(2)}`,
    })),
  ];
};

/**
 * Format customer analytics data for export
 */
export const formatCustomerAnalyticsForExport = (data: {
  newVsRepeat?: { new_customers: number; repeat_customers: number };
  ltvDistribution?: { data: { range: string; count: number }[] };
}) => {
  const rows: Record<string, unknown>[] = [];

  // New vs Repeat
  if (data.newVsRepeat) {
    rows.push({ section: 'Customer Retention' }, {});
    rows.push({
      metric: 'New Customers',
      value: data.newVsRepeat.new_customers,
    });
    rows.push({
      metric: 'Repeat Customers',
      value: data.newVsRepeat.repeat_customers,
    });
    rows.push({});
  }

  // LTV Distribution
  if (data.ltvDistribution && data.ltvDistribution.data.length > 0) {
    rows.push({ section: 'Lifetime Value Distribution' }, {});
    rows.push({ range: 'Value Range', customers: 'Customer Count' });
    data.ltvDistribution.data.forEach((d) =>
      rows.push({ range: d.range, customers: d.count })
    );
  }

  return rows;
};

// ============================================================================
// PDF Generation (Simple Text-based)
// Note: For production, consider using jsPDF or pdfmake
// ============================================================================

/**
 * Generate simple text report (can be converted to PDF)
 */
export const generateTextReport = (title: string, sections: { heading: string; content: string }[]): string => {
  let report = `${title}\n${'='.repeat(title.length)}\n\n`;
  
  sections.forEach((section) => {
    report += `${section.heading}\n${'-'.repeat(section.heading.length)}\n`;
    report += `${section.content}\n\n`;
  });
  
  return report;
};

/**
 * Download text file
 */
export const downloadTextFile = (content: string, filename: string) => {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${filename}.txt`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// ============================================================================
// Report Generation Functions
// ============================================================================

/**
 * Generate and download revenue report
 */
export const generateRevenueReport = (
  trendsData: {
    data: { date: string; revenue: number; appointment_count: number }[];
    total_revenue: number;
    total_appointments: number;
  },
  serviceData: { data: { service: string; count: number; revenue: number }[] }
) => {
  const csvData = [
    ...formatRevenueTrendsForExport(trendsData),
    {},
    ...formatRevenueByServiceForExport(serviceData),
  ];
  downloadCSV(csvData, `revenue-report-${new Date().toISOString().split('T')[0]}`);
};

/**
 * Generate and download appointments report
 */
export const generateAppointmentsReport = (appointmentsData: {
  byDay?: { day: string; count: number }[];
  byHour?: { hour: number; count: number }[];
  status?: { status: string; count: number }[];
  cancellation?: {
    total_appointments: number;
    cancelled: number;
    no_shows: number;
    cancellation_rate: number;
    no_show_rate: number;
  };
}) => {
  const csvData = formatAppointmentsForExport(appointmentsData);
  downloadCSV(csvData, `appointments-report-${new Date().toISOString().split('T')[0]}`);
};

/**
 * Generate and download staff report
 */
export const generateStaffReport = (staffData: {
  data: {
    user_id: string;
    name: string;
    appointment_count: number;
    revenue_generated: number;
  }[];
}) => {
  const csvData = formatStaffUtilizationForExport(staffData);
  downloadCSV(csvData, `staff-report-${new Date().toISOString().split('T')[0]}`);
};

/**
 * Generate and download customer report
 */
export const generateCustomerReport = (customerData: {
  newVsRepeat?: { new_customers: number; repeat_customers: number };
  ltvDistribution?: { data: { range: string; count: number }[] };
}) => {
  const csvData = formatCustomerAnalyticsForExport(customerData);
  downloadCSV(csvData, `customer-report-${new Date().toISOString().split('T')[0]}`);
};

/**
 * Generate comprehensive analytics report
 */
export const generateFullAnalyticsReport = (allData: {
  revenue: {
    trends: {
      data: { date: string; revenue: number; appointment_count: number }[];
      total_revenue: number;
      total_appointments: number;
    };
    byService: { data: { service: string; count: number; revenue: number }[] };
  };
  appointments: {
    byDay?: { day: string; count: number }[];
    byHour?: { hour: number; count: number }[];
    status?: { status: string; count: number }[];
    cancellation?: {
      total_appointments: number;
      cancelled: number;
      no_shows: number;
      cancellation_rate: number;
      no_show_rate: number;
    };
  };
  staff: {
    data: {
      user_id: string;
      name: string;
      appointment_count: number;
      revenue_generated: number;
    }[];
  };
  customers: {
    newVsRepeat?: { new_customers: number; repeat_customers: number };
    ltvDistribution?: { data: { range: string; count: number }[] };
  };
}) => {
  const csvData = [
    // Revenue Section
    { section: 'REVENUE ANALYTICS' },
    ...formatRevenueTrendsForExport(allData.revenue.trends),
    {},
    ...formatRevenueByServiceForExport(allData.revenue.byService),
    {},
    // Appointments Section
    { section: 'APPOINTMENT ANALYTICS' },
    ...formatAppointmentsForExport(allData.appointments),
    {},
    // Staff Section
    { section: 'STAFF ANALYTICS' },
    ...formatStaffUtilizationForExport(allData.staff),
    {},
    // Customer Section
    { section: 'CUSTOMER ANALYTICS' },
    ...formatCustomerAnalyticsForExport(allData.customers),
  ];

  downloadCSV(csvData, `full-analytics-report-${new Date().toISOString().split('T')[0]}`);
};
