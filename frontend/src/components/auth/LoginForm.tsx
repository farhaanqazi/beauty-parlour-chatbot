/*
 * DESIGN DECISIONS
 * Layout: Eliminated standard card boundaries. Uses Spatial Glass layers to create depth.
 * Microcopy: "Authenticate Workspace" instead of "Sign In". Verb + Noun.
 * Motion: The form renders with staggered reveal states. The error alert slides in fluidly.
 * Forms: Uses the custom Input with floating label pattern.
 */
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../hooks/useAuth';
import Input from '../common/Input';
import Button from '../common/Button';
import { AlertTriangle } from 'lucide-react';

const schema = z.object({
  email: z.string().email('Invalid email address format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type FormData = z.infer<typeof schema>;

const LoginForm = () => {
  const { login } = useAuth();
  const [authError, setAuthError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isSubmitSuccessful },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setAuthError(null);
    try {
      await login(data.email, data.password);
    } catch (err: any) {
      setAuthError(err instanceof Error ? err.message : 'Authentication failed. Please check credentials.');
    }
  };

  return (
    <div className="w-full max-w-[400px]">
      <div className="mb-10 text-center select-none">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="inline-block relative"
        >
          <div className="absolute inset-0 bg-[var(--color-accent)] blur-[40px] opacity-20" />
          <h1 className="relative font-display text-3xl font-medium tracking-tight text-white m-0">
            Beauty Parlour
          </h1>
        </motion.div>
        
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="mt-2 text-sm text-[var(--color-neutral-400)] tracking-wide font-mono uppercase"
        >
          System Authorization
        </motion.p>
      </div>

      <motion.form
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        onSubmit={handleSubmit(onSubmit)}
        className="relative bg-[var(--color-surface-raised)] border border-[color:var(--color-surface-overlay)] p-8 rounded-[var(--radius-xl)] shadow-[var(--shadow-xl)] flex flex-col gap-5 overflow-hidden"
        noValidate
      >
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-[color:var(--color-neutral-700)] to-transparent opacity-50" />

        <AnimatePresence>
          {authError && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex items-start gap-3 p-3 mb-1 rounded-[var(--radius-md)] bg-[color:var(--color-danger)]/10 border border-[color:var(--color-danger)]/20 text-[color:var(--color-danger)] text-sm">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                <span>{authError}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <Input
          label="Email Address"
          type="email"
          autoComplete="email"
          disabled={isSubmitting}
          error={errors.email?.message}
          isSuccess={isSubmitSuccessful && !errors.email}
          {...register('email')}
        />

        <Input
          label="Security Key"
          type="password"
          autoComplete="current-password"
          disabled={isSubmitting}
          error={errors.password?.message}
          isSuccess={isSubmitSuccessful && !errors.password}
          {...register('password')}
        />

        <div className="pt-2">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            isLoading={isSubmitting}
          >
            Authenticate Workspace
          </Button>
        </div>
      </motion.form>
    </div>
  );
};

export default LoginForm;
