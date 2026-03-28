import { Toaster } from 'react-hot-toast';

export function AppToaster() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: {
          background: 'hsl(var(--heroui-background))',
          color: 'hsl(var(--heroui-foreground))',
          border: '1px solid hsl(var(--heroui-divider))',
          borderRadius: '0.75rem',
          fontSize: '0.875rem',
          padding: '0.75rem 1rem',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        },
        success: {
          iconTheme: { primary: 'hsl(var(--heroui-success))', secondary: '#fff' },
        },
        error: {
          iconTheme: { primary: 'hsl(var(--heroui-danger))', secondary: '#fff' },
          duration: 6000,
        },
      }}
    />
  );
}
