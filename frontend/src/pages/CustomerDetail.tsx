/**
 * Customer Detail Page
 *
 * Full customer profile view with booking history
 * Route: /customers/:customerId
 */

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CalendarPlus, MessageSquare, Share2, MoreVertical } from 'lucide-react';
import { useCustomer, useCustomerAppointments } from '../hooks/useCustomerDetails';
import { CustomerProfile, CustomerProfileSkeleton } from '../components/customers/CustomerProfile';
import { BookingHistory, BookingHistorySkeleton } from '../components/customers/BookingHistory';

// ============================================================================
// Error State
// ============================================================================

const ErrorState = ({ message, onRetry }: { message: string; onRetry: () => void }) => (
  <div className="flex flex-col items-center justify-center p-12 text-center">
    <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mb-4">
      <svg
        className="w-8 h-8 text-rose-600"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    </div>
    <h3 className="text-lg font-semibold text-neutral-900 mb-2">Failed to load customer</h3>
    <p className="text-neutral-500 mb-4 max-w-md">{message}</p>
    <button
      onClick={onRetry}
      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
    >
      Try Again
    </button>
  </div>
);

// ============================================================================
// Not Found State
// ============================================================================

const NotFoundState = () => (
  <div className="flex flex-col items-center justify-center p-12 text-center">
    <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mb-4">
      <svg
        className="w-8 h-8 text-neutral-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
        />
      </svg>
    </div>
    <h3 className="text-lg font-semibold text-neutral-900 mb-2">Customer not found</h3>
    <p className="text-neutral-500 mb-4">
      The customer you're looking for doesn't exist or has been removed.
    </p>
  </div>
);

// ============================================================================
// Main Component
// ============================================================================

export default function CustomerDetail() {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();
  const [appointmentsPage, setAppointmentsPage] = useState(1);
  const appointmentsPageSize = 20;

  const {
    data: customer,
    isLoading: isCustomerLoading,
    error: customerError,
    refetch: refetchCustomer,
  } = useCustomer(customerId);

  const {
    data: appointmentsData,
    isLoading: isAppointmentsLoading,
    error: appointmentsError,
    refetch: refetchAppointments,
  } = useCustomerAppointments(
    customerId,
    appointmentsPageSize,
    (appointmentsPage - 1) * appointmentsPageSize
  );

  const isLoading = isCustomerLoading || isAppointmentsLoading;
  const error = customerError || appointmentsError;

  const handleRetry = () => {
    refetchCustomer();
    refetchAppointments();
  };

  const handlePageChange = (newPage: number) => {
    setAppointmentsPage(newPage);
  };

  const handleBack = () => {
    navigate(-1);
  };

  // Quick actions (placeholder for future functionality)
  const handleBookAppointment = () => {
    // TODO: Open booking modal pre-filled with customer
    console.log('Book appointment for customer:', customerId);
  };

  const handleMessage = () => {
    // TODO: Open message composer
    console.log('Send message to customer:', customerId);
  };

  const handleShare = () => {
    // TODO: Share customer profile
    console.log('Share customer:', customerId);
  };

  if (error) {
    return <ErrorState message={(error as Error).message || 'Failed to load customer data'} onRetry={handleRetry} />;
  }

  if (!customer && !isLoading) {
    return <NotFoundState />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-amber-50">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200 sticky top-16 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Back button */}
            <button
              onClick={handleBack}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-neutral-700
                       hover:bg-neutral-100 rounded-lg transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5" strokeWidth={2} />
              <span className="hidden sm:inline">Back</span>
            </button>

            {/* Page title */}
            <h1 className="text-lg font-bold text-neutral-900">
              {customer?.display_name || 'Customer Details'}
            </h1>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleBookAppointment}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white
                         bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                aria-label="Book new appointment"
              >
                <CalendarPlus className="w-4 h-4" strokeWidth={2} />
                <span className="hidden sm:inline">Book</span>
              </button>
              <button
                onClick={handleMessage}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-neutral-700
                         bg-white border border-neutral-300 hover:bg-neutral-50 rounded-lg transition-colors"
                aria-label="Send message"
              >
                <MessageSquare className="w-4 h-4" strokeWidth={2} />
                <span className="hidden sm:inline">Message</span>
              </button>
              <button
                onClick={handleShare}
                className="p-2 text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"
                aria-label="Share"
              >
                <Share2 className="w-5 h-5" strokeWidth={2} />
              </button>
              <button
                className="p-2 text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"
                aria-label="More options"
              >
                <MoreVertical className="w-5 h-5" strokeWidth={2} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading || !customer ? (
          /* Loading State */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1">
              <CustomerProfileSkeleton />
            </div>
            <div className="lg:col-span-2">
              <BookingHistorySkeleton />
            </div>
          </div>
        ) : (
          /* Content */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Profile */}
            <div className="lg:col-span-1">
              <CustomerProfile customer={customer} />

              {/* Quick Stats Card */}
              <div className="mt-6 bg-white rounded-2xl p-6 border border-neutral-200 shadow-sm">
                <h3 className="text-sm font-semibold text-neutral-700 uppercase tracking-wide mb-4">
                  Quick Actions
                </h3>
                <div className="space-y-2">
                  <button
                    onClick={handleBookAppointment}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium
                             text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                  >
                    <CalendarPlus className="w-5 h-5" strokeWidth={2} />
                    Book New Appointment
                  </button>
                  <button
                    onClick={handleMessage}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium
                             text-neutral-700 bg-neutral-50 hover:bg-neutral-100 rounded-lg transition-colors"
                  >
                    <MessageSquare className="w-5 h-5" strokeWidth={2} />
                    Send Message
                  </button>
                  <button
                    onClick={handleShare}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium
                             text-neutral-700 bg-neutral-50 hover:bg-neutral-100 rounded-lg transition-colors"
                  >
                    <Share2 className="w-5 h-5" strokeWidth={2} />
                    Share Profile
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column - Booking History */}
            <div className="lg:col-span-2">
              <BookingHistory
                appointments={appointmentsData?.data || []}
                total={appointmentsData?.total || 0}
                page={appointmentsPage}
                pageSize={appointmentsPageSize}
                onPageChange={handlePageChange}
                isLoading={isAppointmentsLoading}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
