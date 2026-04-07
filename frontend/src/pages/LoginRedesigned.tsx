/*
 * LOGIN PAGE - REDESIGNED WITH UI/UX PRO MAX SKILL
 * 
 * Design System: Beauty/Spa/Wellness Service
 * Style: Soft UI Evolution + Neumorphism
 * Colors: Soft pastels (Pink, Sage) + Cream + Gold accents
 * Typography: Playfair Display (headings) + Inter (body)
 * 
 * UI/UX Pro Max Rules Applied:
 * - Accessibility: WCAG AA+ contrast, focus states, keyboard navigation
 * - Touch Targets: Minimum 44×44px on all interactive elements
 * - Animation: 150-300ms duration, ease-out easing
 * - Forms: Visible labels, error placement below field, helper text
 * - Visual: Soft shadows, rounded corners (12-16px), calming aesthetic
 */

import { motion } from 'motion/react';
import LoginForm from '../components/auth/LoginFormRedesigned';
import PageTransition from '../components/common/PageTransition';

const LoginRedesigned = () => {
  return (
    <PageTransition>
      <div className="min-h-screen w-full flex flex-col items-center justify-center relative overflow-hidden">
        {/*
         * BACKGROUND: Dark Craft gradient
         * Color Palette: Dark surfaces with subtle gold/amber accents
         */}
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-surface-base)] via-[var(--color-neutral-800)] to-[var(--color-surface-base)]" />

        {/* Soft ambient radial glow - Dark Craft gold accent */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[700px]
                     bg-gradient-to-r from-[var(--color-accent)]/10 via-amber-500/5 to-[var(--color-accent)]/10
                     rounded-full blur-[120px] opacity-40 pointer-events-none"
        />

        {/* Decorative floating elements - Dark Craft atmosphere */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 0.15, scale: 1 }}
          transition={{ duration: 2, delay: 0.3 }}
          className="absolute top-20 right-20 w-32 h-32 bg-[var(--color-accent)]/10 rounded-full blur-[60px]"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 0.10, scale: 1 }}
          transition={{ duration: 2.5, delay: 0.5 }}
          className="absolute bottom-20 left-20 w-40 h-40 bg-amber-500/10 rounded-full blur-[60px]"
        />

        <LoginForm />

        {/* Footer - Subtle branding */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.6 }}
          className="absolute bottom-6 text-xs text-[var(--color-neutral-500)] tracking-widest uppercase font-mono"
        >
          Secure Authentication // Salon Dashboard
        </motion.div>
      </div>
    </PageTransition>
  );
};

export default LoginRedesigned;
