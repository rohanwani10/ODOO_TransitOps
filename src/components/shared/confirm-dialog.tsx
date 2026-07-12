import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => void;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive";
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "default",
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-surface border border-outline-variant/30 shadow-2xl sm:rounded-xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-headline-md text-title-md text-on-surface">{title}</AlertDialogTitle>
          <AlertDialogDescription className="font-body-md text-on-surface-variant mt-2">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-6">
          <AlertDialogCancel className="bg-white text-on-surface border border-outline-variant hover:bg-surface-container-low font-title-md py-2.5 rounded-lg px-6 transition-colors">
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={variant === "destructive" 
              ? "bg-error text-on-error hover:bg-error/90 font-title-md py-2.5 rounded-lg px-6 transition-all" 
              : "bg-primary text-on-primary hover:bg-primary/90 font-title-md py-2.5 rounded-lg px-6 transition-all"}
          >
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
